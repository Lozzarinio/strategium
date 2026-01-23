import React, { useState } from 'react';
import { api } from '../api';
import './PlayerView.css';

function PlayerView() {
  const [step, setStep] = useState('join'); // 'join', 'select_player', 'input_matrix', 'submitted'
  const [sessionCode, setSessionCode] = useState('');
  const [session, setSession] = useState(null);
  const [yourTeam, setYourTeam] = useState(null);
  const [opponentTeam, setOpponentTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [matrix, setMatrix] = useState({});
  const [error, setError] = useState('');

  const joinSession = async () => {
    if (!sessionCode) {
      setError('Please enter a session code');
      return;
    }

    try {
      const sessionResponse = await api.getSession(sessionCode.toUpperCase());
      setSession(sessionResponse.data);

      // Load tournament to get teams
      const tournamentResponse = await api.getTournament(sessionResponse.data.tournament_id);
      const tournament = tournamentResponse.data;

      const yourTeamData = tournament.teams.find(t => t.id === sessionResponse.data.your_team_id);
      const opponentTeamData = tournament.teams.find(t => t.id === sessionResponse.data.opponent_team_id);

      setYourTeam(yourTeamData);
      setOpponentTeam(opponentTeamData);

      // Initialize empty matrix
      const emptyMatrix = {};
      opponentTeamData.players.forEach(player => {
        emptyMatrix[player.name] = 10; // Default to 10 (draw)
      });
      setMatrix(emptyMatrix);

      setStep('select_player');
      setError('');
    } catch (err) {
      setError('Session not found. Please check the code.');
      console.error('Error joining session:', err);
    }
  };

  const selectPlayer = (playerName) => {
    setSelectedPlayer(playerName);
    setStep('input_matrix');
  };

  const updateScore = (opponentName, score) => {
    setMatrix({
      ...matrix,
      [opponentName]: parseInt(score)
    });
  };

  const submitMatrix = async () => {
    try {
      await api.submitMatrix(sessionCode.toUpperCase(), {
        player_name: selectedPlayer,
        matrix: matrix
      });
      setStep('submitted');
    } catch (err) {
      setError('Error submitting matrix. Please try again.');
      console.error('Error submitting matrix:', err);
    }
  };

  return (
    <div className="player-view">
      <h2>Player View</h2>

      {step === 'join' && (
        <div className="join-section">
          <h3>Join Session</h3>
          <p>Enter the 6-character code from your captain</p>
          <input
            type="text"
            placeholder="e.g. ABC123"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="session-code-input"
          />
          <button className="primary-button" onClick={joinSession}>
            Join Session
          </button>
          {error && <p className="error-message">{error}</p>}
        </div>
      )}

      {step === 'select_player' && (
        <div className="select-player-section">
          <h3>Select Your Name</h3>
          <p>Session: <strong>{sessionCode}</strong></p>
          <p>Your Team: <strong>{yourTeam.name}</strong></p>
          <p>Opponent: <strong>{opponentTeam.name}</strong></p>

          <div className="player-list">
            {yourTeam.players.map(player => (
              <button
                key={player.id}
                className="player-button"
                onClick={() => selectPlayer(player.name)}
              >
                {player.name}
                <br />
                <small>{player.army}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'input_matrix' && (
        <div className="matrix-input-section">
          <h3>Predict Your Matchups</h3>
          <p>Player: <strong>{selectedPlayer}</strong></p>
          <p>Enter your predicted score (0-20) against each opponent:</p>

          <div className="matrix-grid">
            <div className="matrix-header">
              <div>Opponent</div>
              <div>Your Predicted Score</div>
            </div>

            {opponentTeam.players.map(opponent => (
              <div key={opponent.id} className="matrix-row">
                <div className="opponent-info">
                  <strong>{opponent.name}</strong>
                  <br />
                  <small>{opponent.army}</small>
                </div>
                <div className="score-input">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={matrix[opponent.name]}
                    onChange={(e) => updateScore(opponent.name, e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={matrix[opponent.name]}
                    onChange={(e) => updateScore(opponent.name, e.target.value)}
                    className="score-number"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="matrix-summary">
            <h4>Your Predictions Summary:</h4>
            {opponentTeam.players.map(opponent => {
              const score = matrix[opponent.name];
              let label = '';
              if (score >= 16) label = 'Big Win';
              else if (score >= 12) label = 'Win';
              else if (score >= 9) label = 'Close/Draw';
              else if (score >= 5) label = 'Loss';
              else label = 'Big Loss';

              return (
                <div key={opponent.name} className="summary-row">
                  vs {opponent.name}: <strong>{score}/20</strong> ({label})
                </div>
              );
            })}
          </div>

          <button className="primary-button" onClick={submitMatrix}>
            Submit Predictions
          </button>
          <button onClick={() => setStep('select_player')}>
            ← Back
          </button>
        </div>
      )}

      {step === 'submitted' && (
        <div className="submitted-section">
          <h3>✅ Predictions Submitted!</h3>
          <p>Thank you, <strong>{selectedPlayer}</strong></p>
          <p>Your predictions have been submitted to the captain.</p>
          <p>Please wait for the captain to start the pairing process.</p>
        </div>
      )}
    </div>
  );
}

export default PlayerView;