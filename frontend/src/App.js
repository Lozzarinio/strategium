import React, { useState } from 'react';
import './App.css';
import CaptainView from './components/CaptainView';
import PlayerView from './components/PlayerView';

function App() {
  const [view, setView] = useState('home'); // 'home', 'captain', 'player'
  
  return (
    <div className="App">
      <header className="App-header">
        <h1>⚔️ Strategium</h1>
        <p>Warhammer 40K Team Tournament Optimizer</p>
      </header>
      
      <div className="container">
        {view === 'home' && (
          <div className="home-view">
            <h2>Choose Your Role</h2>
            <div className="button-group">
              <button 
                className="primary-button"
                onClick={() => setView('captain')}
              >
                I'm the Captain
              </button>
              <button 
                className="secondary-button"
                onClick={() => setView('player')}
              >
                I'm a Player
              </button>
            </div>
          </div>
        )}
        
        {view === 'captain' && (
          <div>
            <button onClick={() => setView('home')}>← Back</button>
            <CaptainView />
          </div>
        )}
        
        {view === 'player' && (
  <div>
    <button onClick={() => setView('home')}>← Back</button>
    <PlayerView />
  </div>
)}
      </div>
    </div>
  );
}

export default App;