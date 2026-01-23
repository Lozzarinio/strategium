import random
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from collections import defaultdict
import time

@dataclass
class SimulationResult:
    """Results from a single simulation"""
    your_defender: str
    your_attackers: List[str]
    opponent_defender: str
    opponent_attackers: List[str]
    pairings: List[Tuple[str, str]]
    total_score: float
    individual_scores: Dict[str, float]

@dataclass
class OptimizationResult:
    """Final optimization recommendations"""
    best_defender: str
    best_attackers: List[str]
    expected_score: float
    best_case_score: float
    worst_case_score: float
    confidence: float
    decision_tree: Dict[str, str]
    simulations_run: int
    computation_time: float

class PairingOptimizer:
    def __init__(self, 
                 your_team: List[str],
                 opponent_team: List[str],
                 matrices: Dict[str, Dict[str, float]]):
        self.your_team = your_team
        self.opponent_team = opponent_team
        self.matrices = matrices
        
    def get_score(self, your_player: str, opponent_player: str) -> float:
        if your_player not in self.matrices:
            return 10.0
        return self.matrices[your_player].get(opponent_player, 10.0)
    
    def simulate_pairing_round(self, 
                               your_pool: List[str],
                               opponent_pool: List[str],
                               your_defender: str,
                               opponent_defender: str,
                               your_attackers: List[str],
                               opponent_attackers: List[str]) -> List[Tuple[str, str]]:
        pairings = []
        your_turn_first = random.random() < 0.5
        
        if your_turn_first:
            your_attacker = random.choice(your_attackers)
            pairings.append((your_attacker, opponent_defender))
            your_attackers = [a for a in your_attackers if a != your_attacker]
            
            opponent_attacker = random.choice(opponent_attackers)
            pairings.append((your_defender, opponent_attacker))
            opponent_attackers = [a for a in opponent_attackers if a != opponent_attacker]
        else:
            opponent_attacker = random.choice(opponent_attackers)
            pairings.append((your_defender, opponent_attacker))
            opponent_attackers = [a for a in opponent_attackers if a != opponent_attacker]
            
            your_attacker = random.choice(your_attackers)
            pairings.append((your_attacker, opponent_defender))
            your_attackers = [a for a in your_attackers if a != your_attacker]
        
        your_new_defender = your_attackers[0]
        opponent_new_defender = opponent_attackers[0]
        pairings.append((your_new_defender, opponent_new_defender))
        
        your_pool = [p for p in your_pool if p not in [your_defender, your_attacker, your_new_defender]]
        opponent_pool = [p for p in opponent_pool if p not in [opponent_defender, opponent_attacker, opponent_new_defender]]
        
        if len(your_pool) == 2 and len(opponent_pool) == 2:
            your_remaining = your_pool
            opponent_remaining = opponent_pool
            
            your_final_defender = random.choice(your_remaining)
            opponent_final_defender = random.choice(opponent_remaining)
            
            your_final_attacker = [p for p in your_remaining if p != your_final_defender][0]
            opponent_final_attacker = [p for p in opponent_remaining if p != opponent_final_defender][0]
            
            if random.random() < 0.5:
                pairings.append((your_final_attacker, opponent_final_defender))
                pairings.append((your_final_defender, opponent_final_attacker))
            else:
                pairings.append((your_final_defender, opponent_final_attacker))
                pairings.append((your_final_attacker, opponent_final_defender))
        
        return pairings
    
    def run_single_simulation(self,
                            your_defender: str,
                            your_attackers: List[str],
                            opponent_defender: Optional[str] = None,
                            opponent_attackers: Optional[List[str]] = None) -> SimulationResult:
        if opponent_defender is None:
            opponent_defender = random.choice(self.opponent_team)
        
        if opponent_attackers is None:
            remaining = [p for p in self.opponent_team if p != opponent_defender]
            opponent_attackers = random.sample(remaining, 2)
        
        pairings = self.simulate_pairing_round(
            self.your_team.copy(),
            self.opponent_team.copy(),
            your_defender,
            opponent_defender,
            your_attackers.copy(),
            opponent_attackers.copy()
        )
        
        individual_scores = {}
        total_score = 0.0
        
        for your_player, opponent_player in pairings:
            score = self.get_score(your_player, opponent_player)
            individual_scores[your_player] = score
            total_score += score
        
        return SimulationResult(
            your_defender=your_defender,
            your_attackers=your_attackers,
            opponent_defender=opponent_defender,
            opponent_attackers=opponent_attackers,
            pairings=pairings,
            total_score=total_score,
            individual_scores=individual_scores
        )
    
    def optimize(self, num_simulations: int = 10000) -> OptimizationResult:
        start_time = time.time()
        strategy_results = defaultdict(list)
        
        for your_defender in self.your_team:
            remaining = [p for p in self.your_team if p != your_defender]
            
            for i, attacker1 in enumerate(remaining):
                for attacker2 in remaining[i+1:]:
                    your_attackers = [attacker1, attacker2]
                    strategy_key = (your_defender, tuple(sorted(your_attackers)))
                    
                    for _ in range(num_simulations // 60):
                        result = self.run_single_simulation(your_defender, your_attackers)
                        strategy_results[strategy_key].append(result.total_score)
        
        best_strategy = None
        best_avg_score = 0
        
        for strategy_key, scores in strategy_results.items():
            avg_score = sum(scores) / len(scores)
            if avg_score > best_avg_score:
                best_avg_score = avg_score
                best_strategy = strategy_key
        
        best_defender, best_attackers = best_strategy
        best_attackers = list(best_attackers)
        best_scores = strategy_results[best_strategy]
        
        decision_tree = {}
        for opponent_defender in self.opponent_team:
            attacker_scores = {attacker: [] for attacker in best_attackers}
            
            for attacker in best_attackers:
                for _ in range(100):
                    score = self.get_score(attacker, opponent_defender)
                    attacker_scores[attacker].append(score)
            
            best_attacker = max(attacker_scores.keys(), 
                              key=lambda a: sum(attacker_scores[a]) / len(attacker_scores[a]))
            decision_tree[opponent_defender] = best_attacker
        
        computation_time = time.time() - start_time
        
        return OptimizationResult(
            best_defender=best_defender,
            best_attackers=best_attackers,
            expected_score=best_avg_score,
            best_case_score=max(best_scores),
            worst_case_score=min(best_scores),
            confidence=len(best_scores) / num_simulations,
            decision_tree=decision_tree,
            simulations_run=len(best_scores),
            computation_time=computation_time
        )