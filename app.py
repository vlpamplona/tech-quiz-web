"""Tech Translation Quiz — servidor Flask.

Rodar:  python app.py   e abrir  http://127.0.0.1:5000
"""
import secrets

from flask import Flask, jsonify, render_template, request

from quiz_data import TERMS
from quiz_logic import (
    QUESTION_TIME,
    QUESTIONS_PER_GAME,
    Game,
    build_quiz,
    load_seen,
    save_seen,
)

app = Flask(__name__)
GAMES = {}  # partidas em memória (app local, sem banco de dados)
MAX_GAMES = 200


def _game_or_404():
    data = request.get_json(silent=True) or {}
    game = GAMES.get(data.get("game"))
    if game is None:
        return None, data, (jsonify(error="partida não encontrada"), 404)
    return game, data, None


@app.get("/")
def index():
    return render_template(
        "index.html",
        total_questions=QUESTIONS_PER_GAME,
        question_time=QUESTION_TIME,
        total_terms=len(TERMS),
    )


@app.post("/api/start")
def start():
    questions, seen = build_quiz(QUESTIONS_PER_GAME, load_seen())
    save_seen(seen)
    if len(GAMES) >= MAX_GAMES:  # descarta a partida mais antiga
        GAMES.pop(next(iter(GAMES)))
    game_id = secrets.token_urlsafe(8)
    game = Game(questions)
    GAMES[game_id] = game
    return jsonify(game=game_id, question=game.current_public())


@app.post("/api/answer")
def answer():
    game, data, err = _game_or_404()
    if err:
        return err
    try:
        return jsonify(game.answer(data.get("option")))
    except ValueError as e:
        return jsonify(error=str(e)), 400


@app.post("/api/next")
def next_question():
    game, _, err = _game_or_404()
    if err:
        return err
    try:
        q = game.next()
    except ValueError as e:
        return jsonify(error=str(e)), 400
    if q is None:
        return jsonify(finished=True, summary=game.summary())
    return jsonify(finished=False, question=q)


if __name__ == "__main__":
    app.run(debug=True)
