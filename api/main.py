from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, TypedDict
import numpy as np
import pandas as pd
import xgboost as xgb
import shap
import joblib
import json
import os
import re
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.model_selection import train_test_split
from langchain_ollama import OllamaLLM, OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langgraph.graph import StateGraph, END

# App init
app = FastAPI(
    title="Credit Decisioning API",
    description="End-to-end credit risk scoring, explanation, and portfolio optimization",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Load data & train model
print("Loading data and models...")

df = pd.read_csv("data/processed/application_processed.csv")
X  = df.drop(columns=["TARGET"])
y  = df["TARGET"]
X.columns = [str(c).replace("[","").replace("]","").replace("<","")
             for c in X.columns]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

neg = (y_train == 0).sum()
pos = (y_train == 1).sum()

xgb_model = xgb.XGBClassifier(
    n_estimators=300, max_depth=6, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    scale_pos_weight=neg/pos,
    eval_metric="auc", random_state=42, n_jobs=-1
)
xgb_model.fit(X_train, y_train)

explainer    = shap.TreeExplainer(xgb_model)
FEATURE_COLS = list(X_train.columns)

print("Models loaded.")

#Input bounds validation
FEATURE_BOUNDS = {
    "EXT_SOURCE_1"        : (0.0, 1.0),
    "EXT_SOURCE_2"        : (0.0, 1.0),
    "EXT_SOURCE_3"        : (0.0, 1.0),
    "AMT_INCOME_TOTAL"    : (0, 100_000_000),
    "AMT_CREDIT"          : (0, 10_000_000),
    "AMT_ANNUITY"         : (0, 1_000_000),
    "CREDIT_INCOME_RATIO" : (0, 100),
    "ANNUITY_INCOME_RATIO": (0, 10),
    "LOAN_TERM_MONTHS"    : (1, 360),
    "EMPLOYMENT_YEARS"    : (0, 50),
    "AGE_YEARS"           : (18, 100),
}

def validate_features(features: dict) -> list:
    """Return list of validation warnings for out-of-bounds features."""
    warnings = []
    for feat, (low, high) in FEATURE_BOUNDS.items():
        if feat in features:
            val = features[feat]
            if not (low <= val <= high):
                warnings.append(
                    f"{feat}={val} outside expected range [{low}, {high}]"
                )
    return warnings

def coerce_features(raw: dict) -> dict:
    """Coerce all feature values to float — raises 422 on non-numeric."""
    clean = {}
    for k, v in raw.items():
        try:
            clean[k] = float(v)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=422,
                detail=f"Feature '{k}' must be numeric, got: {repr(v)}"
            )
    return clean

#Policy documents & RAG setup
policy_docs = [
    Document(page_content="""
    CREDIT POLICY — SECTION 1: ELIGIBILITY CRITERIA
    Applicants must meet ALL of the following criteria:
    - Minimum age: 21 years. Maximum age at loan maturity: 65 years.
    - Minimum employment duration: 12 months with current employer.
    - Minimum monthly income: $1,500.
    - Maximum debt-to-income ratio: 50%.
    - No active defaults or bankruptcies in the last 5 years.
    """, metadata={"section": "eligibility"}),

    Document(page_content="""
    CREDIT POLICY — SECTION 2: RISK SCORING
    - Low risk   : PD < 10%  → Auto-approve if capital available
    - Medium risk: PD 10-25% → Manual review required
    - High risk  : PD 25-35% → Senior underwriter approval needed
    - Declined   : PD > 35%  → Automatic rejection
    External credit bureau scores (EXT_SOURCE_1/2/3) are primary inputs.
    """, metadata={"section": "risk_scoring"}),

    Document(page_content="""
    CREDIT POLICY — SECTION 3: LOAN PARAMETERS
    - Minimum loan amount : $10,000
    - Maximum loan amount : $500,000
    - Maximum loan term   : 30 years (360 months)
    - Maximum LTV ratio   : 90%
    - Maximum annuity-to-income ratio: 40%
    """, metadata={"section": "loan_parameters"}),

    Document(page_content="""
    CREDIT POLICY — SECTION 4: COUNTERFACTUAL GUIDANCE
    When declined, underwriters must assess:
    - Minimum income increase required to meet DTI threshold
    - Maximum loan amount the applicant qualifies for
    - Minimum external credit score improvement needed
    - Whether a shorter loan term brings annuity ratio into compliance
    """, metadata={"section": "counterfactual"}),
]

splitter     = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50)
chunks       = splitter.split_documents(policy_docs)
embeddings   = OllamaEmbeddings(model="nomic-embed-text")
vector_store = FAISS.from_documents(chunks, embeddings)
retriever    = vector_store.as_retriever(search_kwargs={"k": 3})
llm          = OllamaLLM(
    model       = "llama3.2:1b",  # the LLM's job is now narrow (1-2 narrative sentences over
                                   # given facts) and any hallucination is caught by the
                                   # contradiction filter + deterministic fallback below,
                                   # so the smaller/faster model is safe to use here
    temperature = 0,
    num_predict = 80,    # cap generation length — this machine is CPU-only (no GPU), so token count is the main speed lever; the LLM only writes 1-2 narrative sentences now, facts are built deterministically
    num_ctx     = 2048,  # prompt is short; smaller context window is faster to allocate
    keep_alive  = "30m", # keep the model loaded in memory between requests — avoids the ~15s reload-from-disk cost that was the main source of the old 30s average
)

# Warm the model into memory at startup instead of paying the load cost on the first real request
try:
    llm.invoke("Reply with OK.")
except Exception as e:
    print(f"Ollama warm-up failed (will load on first request instead): {e}")

print("RAG agent ready.")

# LangGraph Agent
class AgentState(TypedDict):
    applicant_id  : int
    question          : str
    applicant_data    : dict
    policy_context    : str
    shap_context      : str
    actionable_context: str
    answer            : str

def get_decision(prob: float) -> str:
    if prob < 0.10: return "AUTO-APPROVE"
    if prob < 0.25: return "MANUAL REVIEW"
    if prob < 0.35: return "SENIOR REVIEW"
    return "DECLINED"

SHAP_LABELS = {
    "EXT_SOURCE_1"              : "Credit Bureau Score 1",
    "EXT_SOURCE_2"              : "Credit Bureau Score 2",
    "EXT_SOURCE_3"              : "Credit Bureau Score 3",
    "AMT_INCOME_TOTAL"          : "Annual Income",
    "AMT_CREDIT"                : "Loan Amount",
    "AMT_ANNUITY"               : "Monthly Annuity",
    "AMT_GOODS_PRICE"           : "Goods Price",
    "CREDIT_INCOME_RATIO"       : "Credit-to-Income Ratio",
    "ANNUITY_INCOME_RATIO"      : "Annuity-to-Income Ratio",
    "CREDIT_GOODS_RATIO"        : "Credit-to-Goods Ratio",
    "LOAN_TERM_MONTHS"          : "Loan Term (Months)",
    "EMPLOYMENT_YEARS"          : "Employment Duration (Years)",
    "AGE_YEARS"                 : "Age (Years)",
    "INCOME_PER_PERSON"         : "Income Per Family Member",
    "FLAG_OWN_CAR"              : "Owns a Car",
    "FLAG_OWN_REALTY"           : "Owns Property",
    "DAYS_BIRTH"                : "Days Since Birth",
    "DAYS_EMPLOYED"             : "Days Employed",
    "DAYS_ID_PUBLISH"           : "Days Since ID Issued",
    "DAYS_LAST_PHONE_CHANGE"    : "Days Since Phone Change",
    "CODE_GENDER"               : "Gender",
    "NAME_EDUCATION_TYPE"       : "Education Level",
    "NAME_FAMILY_STATUS"        : "Family Status",
    "CNT_CHILDREN"              : "Number of Children",
    "CNT_FAM_MEMBERS"           : "Family Members",
    "DOCUMENT_COUNT"            : "Documents Submitted",
    "REGION_RATING_CLIENT"      : "Region Rating",
    "REGION_POPULATION_RELATIVE": "Region Population Density",
    "AMT_REQ_CREDIT_BUREAU_QRT" : "Credit Inquiries (Last Quarter)",
    "DAYS_EMPLOYED_ANOMALY"     : "Unemployed / Pensioner Flag",
    "SK_ID_CURR"                : "Applicant ID",
    "OCCUPATION_TYPE"           : "Occupation Type",
    "NAME_CONTRACT_TYPE"        : "Contract Type",
    "HAS_CAR"                   : "Owns a Car",
    "REGION_RATING_CLIENT_W_CITY": "Region Rating (with City)",
}

# Features an applicant can actually change. Deliberately excludes immutable/demographic
# and location factors (region rating, region population, age, gender, family status, etc.)
# so improvement advice never leans on things the applicant has no control over.
ACTIONABLE_FEATURES = {
    "EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3",
    "AMT_INCOME_TOTAL", "AMT_CREDIT", "AMT_ANNUITY", "AMT_GOODS_PRICE",
    "CREDIT_INCOME_RATIO", "ANNUITY_INCOME_RATIO", "CREDIT_GOODS_RATIO",
    "LOAN_TERM_MONTHS", "INCOME_PER_PERSON", "DOCUMENT_COUNT",
    "AMT_REQ_CREDIT_BUREAU_QRT", "NAME_CONTRACT_TYPE",
}

def get_shap_context(applicant: pd.DataFrame) -> tuple[str, str]:
    shap_vals = explainer.shap_values(applicant)[0]
    shap_df   = pd.DataFrame({
        "feature"    : FEATURE_COLS,
        "shap_value" : shap_vals,
        "feature_val": applicant.values[0]
    }).reindex(
        pd.Series(np.abs(shap_vals)).sort_values(ascending=False).index
    )

    top5 = shap_df.head(5)
    lines = ["Top factors driving this decision:"]
    for _, row in top5.iterrows():
        direction = "INCREASES" if row["shap_value"] > 0 else "DECREASES"
        label     = SHAP_LABELS.get(row["feature"], row["feature"])
        lines.append(
            f"  - {label} = {row['feature_val']:.3f} "
            f"→ {direction} default risk by {abs(row['shap_value']):.3f}"
        )
    shap_context = "\n".join(lines)

    # Top risk-increasing factors the applicant can actually act on, for improvement advice
    actionable = shap_df[
        shap_df["feature"].isin(ACTIONABLE_FEATURES) & (shap_df["shap_value"] > 0)
    ].head(3)
    if actionable.empty:
        actionable_context = "None of the top risk-increasing factors are directly actionable by the applicant."
    else:
        alines = ["Factors the applicant can improve to raise approval odds:"]
        for _, row in actionable.iterrows():
            label = SHAP_LABELS.get(row["feature"], row["feature"])
            alines.append(
                f"  - {label} = {row['feature_val']:.3f} "
                f"→ increases default risk by {row['shap_value']:.3f}"
            )
        actionable_context = "\n".join(alines)

    return shap_context, actionable_context

def get_applicant_node(state: AgentState) -> AgentState:
    applicant = pd.DataFrame(
        [state["applicant_data"]], columns=FEATURE_COLS
    ).fillna(0)
    prob      = float(xgb_model.predict_proba(applicant)[0, 1])
    enriched  = {
        "default_probability": f"{prob:.2%}",
        "decision"           : get_decision(prob),
        **{k: round(float(v), 3) for k, v in state["applicant_data"].items()
           if k in ["EXT_SOURCE_1","EXT_SOURCE_2","EXT_SOURCE_3",
                    "CREDIT_INCOME_RATIO","ANNUITY_INCOME_RATIO",
                    "LOAN_TERM_MONTHS","AMT_INCOME_TOTAL","AMT_CREDIT"]}
    }
    state["applicant_data"] = enriched
    state["shap_context"], state["actionable_context"] = get_shap_context(applicant)
    return state

def retrieve_policy_node(state: AgentState) -> AgentState:
    query  = f"{state['question']} {state['applicant_data']['decision']}"
    docs   = retriever.invoke(query)
    state["policy_context"] = "\n\n".join([d.page_content for d in docs])
    return state

RISK_BAND = {
    "AUTO-APPROVE" : "LOW risk — comfortably under the 10% approval threshold",
    "MANUAL REVIEW": "MODERATE risk (10-25% PD) — above auto-approve threshold, needs human review",
    "SENIOR REVIEW": "ELEVATED risk (25-35% PD) — needs senior underwriter sign-off",
    "DECLINED"     : "HIGH risk (above 35% PD) — exceeds the approval threshold",
}

# Words the LLM has no legitimate reason to use — its job is narrative color, never to
# characterize the decision itself. If any of these leak through, the CPU-bound 3B model
# has likely contradicted the (always-correct) decision computed above, so its output is
# discarded in favor of a deterministic fallback rather than risk showing a wrong claim.
CONTRADICTION_PATTERNS = [
    r"\bdeclin\w*\b", r"\breject\w*\b", r"\bdenied\b", r"\bapproved\b",
]

def has_contradiction(text: str) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in CONTRADICTION_PATTERNS)

def build_fact_sentence(decision: str, prob: str, shap_context: str) -> str:
    """Deterministic, hallucination-free opening sentence — never delegated to the LLM."""
    top_lines = [l.strip().lstrip("- ").strip()
                 for l in shap_context.split("\n")[1:3] if l.strip()]
    return (
        f"This application has a default probability of {prob} "
        f"({RISK_BAND[decision]}), driven mainly by: {'; '.join(top_lines)}."
    )

def build_fallback_narrative(decision: str, actionable_context: str) -> str:
    """Used only if the LLM's narrative is empty or contradicts the actual decision."""
    if decision == "AUTO-APPROVE":
        return "This applicant's profile keeps risk comfortably within the approval threshold — no further action is needed."
    if "None of the top risk-increasing factors are directly actionable" in actionable_context:
        return "No directly actionable factors were identified among this applicant's top risk drivers."
    labels = [l.strip().lstrip("- ").split(" = ")[0]
              for l in actionable_context.split("\n")[1:] if l.strip()]
    return f"To raise approval odds, the applicant should focus on improving: {', '.join(labels)}."

def generate_answer_node(state: AgentState) -> AgentState:
    decision = state["applicant_data"]["decision"]
    prob     = state["applicant_data"]["default_probability"]

    if decision == "AUTO-APPROVE":
        task_instructions = (
            "Explain what specifically makes this a strong application, citing 1-2 of the "
            "SHAP factors that helped. Do NOT suggest any improvements — this applicant is "
            "already approved and needs no advice."
        )
        improvement_block = ""
    else:
        task_instructions = (
            'Give concrete, actionable steps to improve approval odds, using ONLY the '
            'factors listed under "Factors the applicant can improve to raise approval '
            'odds" below. If that section says nothing is directly actionable, say so '
            "plainly instead of inventing a suggestion."
        )
        improvement_block = f"\n{state['actionable_context']}\n"

    prompt = f"""
You are a senior credit risk analyst assistant. A separate system has already made the
approve/decline decision and shown it to the loan officer — your only job is to add brief
narrative color, never to state or imply the decision yourself. Do NOT invent numbers,
policies, or facts that are not in the data given to you below.

APPLICANT DATA:
{json.dumps(state['applicant_data'], indent=2)}

SHAP EXPLANATION (the ONLY factors you may cite, with their EXACT direction — never invert INCREASES/DECREASES):
{state['shap_context']}
{improvement_block}
RELEVANT POLICY:
{state['policy_context']}

LOAN OFFICER QUESTION:
{state['question']}

Write exactly 1-2 short sentences, plain text, no headers:
- {task_instructions}
- NEVER suggest changing region, location, gender, age, family status, or any other
  factor the applicant cannot control, even if it appears in the SHAP EXPLANATION above
- Do NOT use the words "approved", "declined", "rejected", or "denied" anywhere — that
  decision is already communicated elsewhere
"""
    raw_answer = llm.invoke(prompt).strip()
    raw_answer = re.sub(r'^FINAL (ANSWER|DECISION)\s*:.*\n*', '', raw_answer, flags=re.IGNORECASE).strip()

    narrative = raw_answer if raw_answer and not has_contradiction(raw_answer) \
        else build_fallback_narrative(decision, state.get("actionable_context", ""))

    fact_sentence  = build_fact_sentence(decision, prob, state["shap_context"])
    state["answer"] = f"FINAL ANSWER: {decision}\n\n{fact_sentence} {narrative}"
    return state

graph = StateGraph(AgentState)
graph.add_node("get_applicant",   get_applicant_node)
graph.add_node("retrieve_policy", retrieve_policy_node)
graph.add_node("generate_answer", generate_answer_node)
graph.set_entry_point("get_applicant")
graph.add_edge("get_applicant",   "retrieve_policy")
graph.add_edge("retrieve_policy", "generate_answer")
graph.add_edge("generate_answer", END)
agent = graph.compile()

#Request schemas
class ApplicantFeatures(BaseModel):
    features: dict

class AskRequest(BaseModel):
    features: dict
    question: str

class PortfolioRequest(BaseModel):
    n_applicants: Optional[int]   = 500
    capital     : Optional[float] = 10_000_000

#Endpoints
@app.get("/")
def root():
    return {
        "service"  : "Credit Decisioning API",
        "version"  : "1.0.0",
        "endpoints": ["/score", "/explain", "/ask", "/portfolio", "/health"]
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model" : "xgboost",
        "agent" : "langgraph+ollama"
    }

@app.post("/score")
def score(request: ApplicantFeatures):
    """Score an applicant — returns PD, decision, and any input warnings."""
    try:
        clean    = coerce_features(request.features)
        warnings = validate_features(clean)
        applicant = pd.DataFrame([clean], columns=FEATURE_COLS).fillna(0)
        prob      = float(xgb_model.predict_proba(applicant)[0, 1])
        return {
            "default_probability"    : round(prob, 4),
            "default_probability_pct": f"{prob:.2%}",
            "decision"               : get_decision(prob),
            "model"                  : "xgboost_champion",
            "warnings"               : warnings if warnings else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/explain")
def explain(request: ApplicantFeatures):
    """Return SHAP explanation for an applicant."""
    try:
        clean     = coerce_features(request.features)
        warnings  = validate_features(clean)
        applicant = pd.DataFrame([clean], columns=FEATURE_COLS).fillna(0)
        prob      = float(xgb_model.predict_proba(applicant)[0, 1])
        shap_vals = explainer.shap_values(applicant)[0]

        shap_df = pd.DataFrame({
            "feature"      : FEATURE_COLS,
            "shap_value"   : shap_vals,
            "feature_value": applicant.values[0]
        }).reindex(
            pd.Series(np.abs(shap_vals)).sort_values(ascending=False).index
        ).head(10)

        return {
            "default_probability": round(prob, 4),
            "decision"           : get_decision(prob),
            "top_factors"        : shap_df.to_dict(orient="records"),
            "warnings"           : warnings if warnings else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/ask")
def ask(request: AskRequest):
    """Ask the RAG agent a question about an applicant."""
    try:
        clean  = coerce_features(request.features)
        result = agent.invoke({
            "applicant_id"  : 0,
            "question"      : request.question,
            "applicant_data": clean,
            "policy_context": "",
            "shap_context"  : "",
            "answer"        : ""
        })
        return {
            "decision"           : result["applicant_data"].get("decision"),
            "default_probability": result["applicant_data"].get("default_probability"),
            "shap_context"       : result["shap_context"],
            "answer"             : result["answer"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/portfolio")
def portfolio():
    """Return latest portfolio optimization summary."""
    try:
        approved = pd.read_csv("data/processed/approved_loans.csv")
        rejected = pd.read_csv("data/processed/rejected_loans.csv")
        return {
            "loans_approved"       : len(approved),
            "loans_rejected"       : len(rejected),
            "capital_deployed"     : round(approved["loan_amount"].sum(), 2),
            "avg_default_prob"     : round(approved["default_prob"].mean(), 4),
            "total_risk_adj_return": round(approved["risk_adj_return"].sum(), 2),
            "return_on_capital"    : round(
                approved["risk_adj_return"].sum() / approved["loan_amount"].sum(), 4
            )
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))