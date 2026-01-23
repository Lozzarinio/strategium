import axios from 'axios';

const API_BASE_URL = 'https://obscure-pancake-qxqrgvq9r45fw5v-8000.app.github.dev';

export const api = {
  // Tournament endpoints
  getTournaments: () => axios.get(`${API_BASE_URL}/tournaments`),
  getTournament: (id) => axios.get(`${API_BASE_URL}/tournaments/${id}`),
  getTournamentSessions: (tournamentId) => axios.get(`${API_BASE_URL}/tournaments/${tournamentId}/sessions`),
  
  // Session endpoints
  createSession: (data) => axios.post(`${API_BASE_URL}/sessions`, data),
  getSession: (code) => axios.get(`${API_BASE_URL}/sessions/${code}`),
  
  // Matrix endpoints
  submitMatrix: (code, data) => axios.post(`${API_BASE_URL}/sessions/${code}/matrix`, data),
  getMatrices: (code) => axios.get(`${API_BASE_URL}/sessions/${code}/matrices`),
  
  // Optimization endpoints
  optimize: (code) => axios.post(`${API_BASE_URL}/sessions/${code}/optimize`),
  getRecommendation: (code, data) => axios.post(`${API_BASE_URL}/sessions/${code}/recommend`, data),
};