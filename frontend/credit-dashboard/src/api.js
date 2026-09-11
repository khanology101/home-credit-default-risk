import axios from 'axios';

const BASE = 'http://localhost:8000';

export const healthCheck  = ()       => axios.get(`${BASE}/health`);
export const getPortfolio = ()       => axios.get(`${BASE}/portfolio`);
export const scoreApplicant = (features) =>
  axios.post(`${BASE}/score`,   { features });
export const explainApplicant = (features) =>
  axios.post(`${BASE}/explain`, { features });
export const askAgent = (features, question) =>
  axios.post(`${BASE}/ask`,     { features, question });