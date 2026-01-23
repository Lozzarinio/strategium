import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './CaptainView.css';

function CaptainView() {
  const [step, setStep] = useState('setup'); // 'setup', 'resume', 'list_sessions', 'waiting', 'pairing'
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [yourTeam, setYourTeam] = useState(null);
  const [opponentTeam, setOpponentTeam] = useState(null);
  const [sessionCode, setSessionCode] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [matrices, setMatrices] = useState({});
  const [recommendation, setRecommendation] = useState(null);
  const [allSessions, setAllSessions] = useState([]);
  
  // Pairing state
  const [unpairedYourTeam, setUnpairedYourTeam] = useState([]);
  const [unpairedOpponentTeam, setUnpairedOpponentTeam] = useState([]);
  const [pairingStep, setPairingStep] = useState('pick_defender');
  const [yourDefender, setYourDefender] = useState('');
  const [opponentDefender, setOpponentDefender] = useState('');
  const [opponentAttackers, setOpponentAttackers] = useState([]);
  
  useEffect(() => {
    loadTournaments();
  }, []);
  
  const loadTournaments = async () => {
    try {
      const response = await api.getTournaments();
      setTournaments(response.data);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  };
  
  const selectTournament = async (tournamentId) => {
    try {
      const response = await api.getTournament(tournamentId);
      setSelectedTournament(response.data);
    } catch (error) {
      console.error('Error loading tournament:', error);
    }
  };
  
  const loadTournamentSessions = async (tournamentId) => {
    try {
      const response = await api.getTournamentSessions(tournamentId);
      setAllSessions(response.data);
      setStep('list_sessions');
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };
  
  const createSession = async () => {
    if (!yourTeam || !opponentTeam) {
      alert('Please select both teams');
      return;
    }
    
    if (!sessionName) {
      alert('Please enter a session name (e.g., "Round 1", "Finals")');
      return;
    }
    
    try {
      const response = await api.createSession({
        tournament_id: selectedTournament.id,
        your_team_id: yourTeam.id,
        opponent_team_id: opponentTeam.id,
        round_number: 1,
        round_name: sessionName
      });
      
      setSessionCode(response.data.code);
      setStep('waiting');
      
      setUnpairedYourTeam(yourTeam.players.map(p => p.name));
      setUnpairedOpponentTeam(opponentTeam.players.map(p => p.name));
      
      pollMatrices(response.data.code);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };
  
  const resumeSession = async (code) => {
    try {
      const sessionResponse = await api.getSession(code);
      const session = sessionResponse.data;
      
      const tournamentResponse = await api.getTournament(session.tournament_id);
      const tournament = tournamentResponse.data;
      
      const yourTeamData = tournament.teams.find(t => t.id === session.your_team_id);
      const opponentTeamData = tournament.teams.find(t => t.id === session.opponent_team_id);
      
      setYourTeam(yourTeamData);
      setOpponentTeam(opponentTeamData);
      setSelectedTournament(tournament);
      setSessionCode(code);
      setSessionName(session.round_name || '');
      
      setUnpairedYourTeam(yourTeamData.players.map(p => p.name));
      setUnpairedOpponentTeam(opponentTeamData.players.map(p => p.name));
      
      const matricesResponse = await api.getMatrices(code);
      setMatrices(matricesResponse.data.matrices);
      
      pollMatrices(code);
      setStep('waiting');
    } catch (error) {
      alert('Session not found. Please check the code.');
      console.error('Error resuming session:', error);
    }
  };
  
  const pollMatrices = async (code) => {
    const interval = setInterval(async () => {
      try {
        const response = await api.getMatrices(code);
        setMatrices(response.data.matrices);
        
        if (yourTeam && Object.keys(response.data.matrices).length >= yourTeam.players.length) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Error polling matrices:', error);
      }
    }, 2000);
  };
  
  const startPairing = () => {
    setStep('pairing');
    setPairingStep('pick_defender');
    getRecommendation('pick_defender');
  };
  
  const getRecommendation = async (decisionType, extraData = {}) => {
    try {
      const requestData = {
        decision_type: decisionType,
        unpaired_your_team: unpairedYourTeam,
        unpaired_opponent_team: unpairedOpponentTeam,
        ...extraData
      };
      
      const response = await api.getRecommendation(sessionCode, requestData);
      setRecommendation(response.data);
    } catch (error) {
      console.error('Error getting recommendation:', error);
    }
  };
  
  const pickDefender = (defender) => {
    setYourDefender(defender);
    setPairingStep('enter_opponent_defender');
  };
  
  const submitOpponentDefender = () => {
    if (!opponentDefender) {
      alert('Please enter opponent defender');
      return;
    }
    setPairingStep('pick_attackers');
    getRecommendation('pick_attackers', {
      your_defender: yourDefender,
      opponent_defender: opponentDefender
    });
  };
  
  return (
    <div className="captain-view">
      <h2>Captain Dashboard</h2>
      
      {step === 'setup' && (
        <div className="setup-section">
          <h3>Session Setup</h3>
          
          <div className="session-options" style={{marginBottom: '2rem'}}>
            <button 
              className="primary-button"
              onClick={() => setStep('resume')}
            >
              Resume Session by Code
            </button>
            <p style={{margin: '1rem 0', textAlign: 'center'}}>or</p>
            <h4>Create New Session:</h4>
          </div>
          
          {!selectedTournament ? (
            <div>
              <h4>Select Tournament:</h4>
              {tournaments.map(tournament => (
                <div key={tournament.id} className="tournament-card">
                  <h5>{tournament.name}</h5>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button onClick={() => selectTournament(tournament.id)}>
                      Create Session
                    </button>
                    <button onClick={() => loadTournamentSessions(tournament.id)}>
                      View Sessions
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <h4>Tournament: {selectedTournament.name}</h4>
              <button onClick={() => setSelectedTournament(null)} style={{marginBottom: '1rem'}}>
                ← Back to Tournaments
              </button>
              
              <div style={{marginBottom: '1.5rem'}}>
                <label><strong>Session Name:</strong></label>
                <input
                  type="text"
                  placeholder="e.g., Round 1, Semi-Finals, etc."
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    marginTop: '0.5rem',
                    background: '#0f1626',
                    border: '2px solid #667eea',
                    borderRadius: '8px',
                    color: '#eee',
                    fontSize: '1rem'
                  }}
                />
              </div>
              
              <div className="team-selection">
                <div>
                  <h5>Select Your Team:</h5>
                  {selectedTournament.teams.map(team => (
                    <div 
                      key={team.id} 
                      className={`team-card ${yourTeam?.id === team.id ? 'selected' : ''}`}
                      onClick={() => setYourTeam(team)}
                    >
                      <strong>{team.name}</strong>
                      <ul>
                        {team.players.map(player => (
                          <li key={player.id}>{player.name}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                
                <div>
                  <h5>Select Opponent Team:</h5>
                  {selectedTournament.teams.filter(t => t.id !== yourTeam?.id).map(team => (
                    <div 
                      key={team.id} 
                      className={`team-card ${opponentTeam?.id === team.id ? 'selected' : ''}`}
                      onClick={() => setOpponentTeam(team)}
                    >
                      <strong>{team.name}</strong>
                      <ul>
                        {team.players.map(player => (
                          <li key={player.id}>{player.name}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
              
              {yourTeam && opponentTeam && sessionName && (
                <button className="primary-button" onClick={createSession}>
                  Create Session
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      {step === 'list_sessions' && (
        <div className="sessions-list">
          <h3>All Sessions</h3>
          <button onClick={() => setStep('setup')} style={{marginBottom: '1rem'}}>
            ← Back
          </button>
          
          {allSessions.length === 0 ? (
            <p>No sessions found for this tournament.</p>
          ) : (
            <div className="sessions-grid">
              {allSessions.map(session => (
                <div key={session.id} className="session-card">
                  <h4>{session.round_name || 'Unnamed Session'}</h4>
                  <p><strong>Code:</strong> <span className="session-code-small">{session.code}</span></p>
                  <p><small>Round {session.round_number}</small></p>
                  <button 
                    className="primary-button"
                    onClick={() => resumeSession(session.code)}
                  >
                    Open Session
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {step === 'resume' && (
        <div className="resume-section">
          <h3>Resume Session by Code</h3>
          <p>Enter your session code:</p>
          <input
            type="text"
            placeholder="e.g. ABC123"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="session-code-input"
            style={{fontSize: '2rem', textAlign: 'center', letterSpacing: '0.3em'}}
          />
          <div style={{marginTop: '1rem'}}>
            <button 
              className="primary-button"
              onClick={() => resumeSession(sessionCode)}
            >
              Resume Session
            </button>
            <button onClick={() => setStep('setup')} style={{marginLeft: '1rem'}}>
              ← Back
            </button>
          </div>
        </div>
      )}
      
      {step === 'waiting' && (
        <div className="waiting-section">
          <h3>{sessionName && <span>{sessionName} - </span>}Session Code: <span className="session-code">{sessionCode}</span></h3>
          <p>Share this code with your team players</p>
          
          <div className="matrix-status">
            <h4>Matrix Submissions:</h4>
            <p>{Object.keys(matrices).length} / {yourTeam.players.length} players submitted</p>
            <ul>
              {yourTeam.players.map(player => (
                <li key={player.id}>
                  {player.name}: {matrices[player.name] ? '✅' : '⏳'}
                </li>
              ))}
            </ul>
          </div>
          
          {Object.keys(matrices).length > 0 && (
            <div className="matrix-display">
              <h4>Submitted Predictions:</h4>
              <div className="matrix-table">
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      {opponentTeam.players.map(opp => (
                        <th key={opp.id}>vs {opp.name}</th>
                      ))}
                      <th>Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yourTeam.players.map(player => {
                      if (!matrices[player.name]) return null;
                      
                      const playerMatrix = matrices[player.name];
                      const scores = opponentTeam.players.map(opp => playerMatrix[opp.name] || 10);
                      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
                      
                      return (
                        <tr key={player.id}>
                          <td><strong>{player.name}</strong></td>
                          {opponentTeam.players.map(opp => {
                            const score = playerMatrix[opp.name] || 10;
                            let colorClass = '';
                            if (score >= 15) colorClass = 'score-high';
                            else if (score >= 11) colorClass = 'score-good';
                            else if (score >= 9) colorClass = 'score-neutral';
                            else if (score >= 5) colorClass = 'score-bad';
                            else colorClass = 'score-low';
                            
                            return (
                              <td key={opp.id} className={colorClass}>
                                {score}
                              </td>
                            );
                          })}
                          <td><strong>{avg}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {Object.keys(matrices).length >= yourTeam.players.length && (
            <button className="primary-button" onClick={startPairing}>
              Start Pairing Process
            </button>
          )}
        </div>
      )}
      
      {step === 'pairing' && (
        <div className="pairing-section">
          <h3>Pairing Process</h3>
          
          {pairingStep === 'pick_defender' && recommendation && (
            <div>
              <h4>Step 1: Pick Your Defender</h4>
              <p>Recommended: <strong>{recommendation.recommendation}</strong></p>
              <p>Expected Total Score: {recommendation.expected_total_score}/100</p>
              
              <div className="options">
                <h5>All Options:</h5>
                {Object.entries(recommendation.all_options).map(([player, score]) => (
                  <button 
                    key={player}
                    className={player === recommendation.recommendation ? 'recommended' : ''}
                    onClick={() => pickDefender(player)}
                  >
                    {player}: {score}/100
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {pairingStep === 'enter_opponent_defender' && (
            <div>
              <h4>Enter Opponent's Defender</h4>
              <p>You picked: <strong>{yourDefender}</strong></p>
              <select 
                value={opponentDefender} 
                onChange={(e) => setOpponentDefender(e.target.value)}
              >
                <option value="">Select opponent defender...</option>
                {unpairedOpponentTeam.map(player => (
                  <option key={player} value={player}>{player}</option>
                ))}
              </select>
              <button onClick={submitOpponentDefender}>Next</button>
            </div>
          )}
          
          {pairingStep === 'pick_attackers' && recommendation && (
            <div>
              <h4>Step 2: Pick Your 2 Attackers</h4>
              <p>Opponent's defender: <strong>{opponentDefender}</strong></p>
              <p>Recommended: <strong>{recommendation.recommendation.join(', ')}</strong></p>
              <p>Expected Total Score: {recommendation.expected_total_score}/100</p>
              
              <div className="options">
                <h5>All Attacker Pairs:</h5>
                {Object.entries(recommendation.all_options).map(([pair, score]) => (
                  <div key={pair}>
                    {pair}: {score}/100
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CaptainView;