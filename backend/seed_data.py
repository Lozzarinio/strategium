from models import init_db, SessionLocal, Tournament, Team, Player

def seed_test_data():
    init_db()
    db = SessionLocal()
    
    try:
        # Check if data already exists
        existing = db.query(Tournament).first()
        if existing:
            print("Database already seeded")
            return
        
        # Create tournament
        tournament = Tournament(name="Test Tournament 2024")
        db.add(tournament)
        db.flush()
        
        # Create Your Team
        your_team = Team(
            tournament_id=tournament.id,
            name="Fire and Dice Test"
        )
        db.add(your_team)
        db.flush()
        
        your_players = ["Laurence", "Byron", "Denis", "Sam", "Euan"]
        for player_name in your_players:
            player = Player(
                team_id=your_team.id,
                name=player_name,
                army="Space Marines",  # Placeholder
                archetype="Balanced"
            )
            db.add(player)
        
        # Create Opponent Team
        opponent_team = Team(
            tournament_id=tournament.id,
            name="Enemy Team 1"
        )
        db.add(opponent_team)
        db.flush()
        
        opponent_players = ["Jack", "John", "James", "Jim", "Joe"]
        for player_name in opponent_players:
            player = Player(
                team_id=opponent_team.id,
                name=player_name,
                army="Chaos",  # Placeholder
                archetype="Aggressive"
            )
            db.add(player)
        
        db.commit()
        print("✓ Database seeded with test data")
        print(f"  Tournament: {tournament.name}")
        print(f"  Your Team: {your_team.name} ({len(your_players)} players)")
        print(f"  Opponent: {opponent_team.name} ({len(opponent_players)} players)")
        
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_test_data()
