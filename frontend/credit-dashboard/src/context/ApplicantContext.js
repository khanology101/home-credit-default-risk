import { createContext, useContext, useState } from 'react';

const ApplicantContext = createContext();

export const FEATURE_LABELS = {
  EXT_SOURCE_1              : 'Credit Bureau Score 1',
  EXT_SOURCE_2              : 'Credit Bureau Score 2',
  EXT_SOURCE_3              : 'Credit Bureau Score 3',
  AMT_INCOME_TOTAL          : 'Annual Income ($)',
  AMT_CREDIT                : 'Loan Amount ($)',
  AMT_ANNUITY               : 'Monthly Annuity ($)',
  AMT_GOODS_PRICE           : 'Goods Price ($)',
  CREDIT_INCOME_RATIO       : 'Credit-to-Income Ratio',
  ANNUITY_INCOME_RATIO      : 'Annuity-to-Income Ratio',
  CREDIT_GOODS_RATIO        : 'Credit-to-Goods Ratio',
  LOAN_TERM_MONTHS          : 'Loan Term (Months)',
  EMPLOYMENT_YEARS          : 'Employment Duration (Years)',
  AGE_YEARS                 : 'Age (Years)',
  INCOME_PER_PERSON         : 'Income Per Family Member ($)',
  HAS_CAR                   : 'Owns a Car',
  FLAG_OWN_CAR              : 'Owns a Car',
  FLAG_OWN_REALTY           : 'Owns Property',
  DAYS_BIRTH                : 'Days Since Birth',
  DAYS_EMPLOYED             : 'Days Employed',
  DAYS_ID_PUBLISH           : 'Days Since ID Issued',
  DAYS_LAST_PHONE_CHANGE    : 'Days Since Phone Change',
  CODE_GENDER               : 'Gender',
  NAME_CONTRACT_TYPE        : 'Contract Type',
  NAME_EDUCATION_TYPE       : 'Education Level',
  NAME_FAMILY_STATUS        : 'Family Status',
  CNT_CHILDREN              : 'Number of Children',
  CNT_FAM_MEMBERS           : 'Family Members',
  DOCUMENT_COUNT            : 'Documents Submitted',
  REGION_RATING_CLIENT      : 'Region Rating',
  REGION_RATING_CLIENT_W_CITY: 'Region Rating (with City)',
  REGION_POPULATION_RELATIVE : 'Region Population Density',
  AMT_REQ_CREDIT_BUREAU_QRT : 'Credit Inquiries (Last Quarter)',
  DAYS_EMPLOYED_ANOMALY     : 'Unemployed / Pensioner Flag',
  SK_ID_CURR                : 'Applicant ID',
  OCCUPATION_TYPE           : 'Occupation Type',
};

export const DEFAULT_FEATURES = {
  EXT_SOURCE_1: 0.5, EXT_SOURCE_2: 0.6, EXT_SOURCE_3: 0.55,
  AMT_INCOME_TOTAL: 150000, AMT_CREDIT: 450000, AMT_ANNUITY: 25000,
  AMT_GOODS_PRICE: 450000, DAYS_BIRTH: -12000, DAYS_EMPLOYED: -2000,
  CREDIT_INCOME_RATIO: 3.0, ANNUITY_INCOME_RATIO: 0.167,
  CREDIT_GOODS_RATIO: 1.0, LOAN_TERM_MONTHS: 18.0,
  INCOME_PER_PERSON: 75000, AGE_YEARS: 35,
  EMPLOYMENT_YEARS: 5.5, HAS_CAR: 1, DOCUMENT_COUNT: 3,
  DAYS_EMPLOYED_ANOMALY: 0, NAME_EDUCATION_TYPE: 3,
  CODE_GENDER: 1, NAME_CONTRACT_TYPE: 0,
  DAYS_ID_PUBLISH: -3000, DAYS_LAST_PHONE_CHANGE: -500,
  FLAG_OWN_CAR: 1, FLAG_OWN_REALTY: 1,
  CNT_CHILDREN: 0, CNT_FAM_MEMBERS: 2,
  REGION_RATING_CLIENT: 2, REGION_RATING_CLIENT_W_CITY: 2,
  AMT_REQ_CREDIT_BUREAU_QRT: 1,
};

export function ApplicantProvider({ children }) {
  const [features,  setFeatures]  = useState(DEFAULT_FEATURES);
  const [lastScore, setLastScore] = useState(null);

  return (
    <ApplicantContext.Provider value={{ features, setFeatures, lastScore, setLastScore }}>
      {children}
    </ApplicantContext.Provider>
  );
}

export function useApplicant() {
  return useContext(ApplicantContext);
}