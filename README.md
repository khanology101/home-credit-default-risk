# Credit Decisioning System

End-to-end ML system for credit risk scoring, portfolio optimization, and agentic explainability.

## Stack
- **Modeling**: Logistic Regression (baseline) + XGBoost (champion)
- **Explainability**: SHAP global + per-applicant
- **Optimization**: IBM CPLEX / docplex portfolio allocation
- **Agentic AI**: LangGraph + Ollama llama3.2:1b + FAISS RAG
- **API**: FastAPI
- **Frontend**: React + Tailwind CSS

## Results
| Metric | Baseline (LR) | Champion (XGBoost) |
|--------|--------------|-------------------|
| AUC-ROC | 0.7476 | 0.7688 |
| Gini | 0.4952 | 0.5376 |
| KS Stat | 0.3665 | 0.4036 |
| PR-AUC | 0.2288 | 0.2596 |

Portfolio: 22.41% return on capital, $10M deployed, 100% utilization.

## Setup

### 1. Clone & install
```bash
git clone https://github.com/khanology101/home-credit-default-risk.git
cd home-credit-default-risk
py -3.10 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Download dataset
Get `application_train.csv` from [Kaggle](https://www.kaggle.com/competitions/home-credit-default-risk/data) and place it in `data/raw/`.

### 3. Pull Ollama models
```bash
ollama pull llama3.2:1b
ollama pull nomic-embed-text
```

### 4. Run notebooks in order

01_eda_baseline.ipynb
02_feature_engineering.ipynb
03_baseline_model.ipynb
04_champion_model.ipynb
05_shap_explainability.ipynb
06_portfolio_optimization.ipynb
07_rag_agent.ipynb

`data/`, `models/`, and the generated report images are not committed to this repo — running
the notebooks regenerates them locally. In particular, `data/processed/application_processed.csv`
must exist before starting the API, since it's loaded and used to train the model at startup.

### 5. Start API
```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Start frontend
```bash
cd frontend/credit-dashboard
npm install
npm start
```

Open `http://localhost:3000`

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | API status |
| `/score` | POST | Score applicant, return PD + decision |
| `/explain` | POST | SHAP feature attributions |
| `/ask` | POST | RAG agent natural language Q&A |
| `/portfolio` | GET | Portfolio optimization summary |

## Dataset
Home Credit Default Risk — 307,511 applications, 122 features, 8.07% default rate.