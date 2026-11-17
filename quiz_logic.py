"""Regras do quiz: montagem das perguntas, pontuação, ranking e histórico."""
import json
import random
import time
from pathlib import Path

from quiz_data import TERMS

QUESTIONS_PER_GAME = 15
OPTIONS_PER_QUESTION = 4
QUESTION_TIME = 20  # segundos por pergunta
POINTS_PER_HIT = 100

# Histórico de termos já usados (equivale ao `historico_termos` do quiz.py original).
HISTORY_FILE = Path(__file__).with_name("historico.json")


def load_seen():
    try:
        data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        return [i for i in data if isinstance(i, int)]
    except (OSError, ValueError):
        return []


def save_seen(ids):
    try:
        HISTORY_FILE.write_text(json.dumps(ids), encoding="utf-8")
    except OSError:
        pass  # sem permissão de escrita: o rodízio só não persiste


def _build_question(term, rng):
    same = [t for t in TERMS if t["category"] == term["category"] and t["en"] != term["en"]]
    others = [t for t in TERMS if t["category"] != term["category"] and t["en"] != term["en"]]
    rng.shuffle(same)
    rng.shuffle(others)

    distractors = []
    for t in same + others:
        if len(distractors) == OPTIONS_PER_QUESTION - 1:
            break
        if t["en"] not in distractors:
            distractors.append(t["en"])

    options = [term["en"]] + distractors
    rng.shuffle(options)
    return {
        "id": term["id"],
        "category": term["category"],
        "prompt": term["pt"],
        "options": options,
        "correct_index": options.index(term["en"]),  # recalculado após embaralhar
        "answer": term["en"],
    }


def build_quiz(count=QUESTIONS_PER_GAME, seen_ids=None, rng=random):
    """Sorteia `count` termos priorizando os inéditos. Retorna (perguntas, histórico novo)."""
    seen_ids = list(seen_ids or [])
    seen_set = set(seen_ids)
    unseen = [t for t in TERMS if t["id"] not in seen_set]
    rng.shuffle(unseen)

    if len(unseen) >= count:
        picked = unseen[:count]
        seen = seen_ids + [t["id"] for t in picked]
    else:  # banco esgotado: usa os inéditos e recomeça o ciclo
        taken = {t["id"] for t in unseen}
        refill = [t for t in TERMS if t["id"] not in taken]
        rng.shuffle(refill)
        refill = refill[: count - len(unseen)]
        picked = unseen + refill
        seen = [t["id"] for t in refill]

    rng.shuffle(picked)
    return [_build_question(t, rng) for t in picked], seen


def get_rank(percent):
    if percent >= 90:
        return "Mestre da tecnologia!", "master"
    if percent >= 70:
        return "Muito bem!", "great"
    if percent >= 40:
        return "Conhecedor em evolução", "mid"
    return "Iniciante em tecnologia", "low"


class Game:
    """Estado de uma partida. A resposta correta só sai do servidor depois de respondida."""

    def __init__(self, questions, now=None):
        self.questions = questions
        self.index = 0
        self.score = 0
        self.results = []  # [{correct, timed_out}]
        self.answered = False
        self.started_at = now if now is not None else time.time()
        self.ended_at = None

    @property
    def finished(self):
        return self.ended_at is not None

    def current_public(self):
        q = self.questions[self.index]
        return {
            "number": self.index + 1,
            "total": len(self.questions),
            "category": q["category"],
            "prompt": q["prompt"],
            "options": q["options"],
            "time": QUESTION_TIME,
            "score": self.score,
        }

    def answer(self, option):
        """option = índice escolhido, ou None quando o tempo esgotou. Respostas duplicadas são bloqueadas."""
        if self.finished or self.answered:
            raise ValueError("pergunta já respondida")
        q = self.questions[self.index]
        timed_out = option is None
        if not timed_out and (not isinstance(option, int) or isinstance(option, bool) or not 0 <= option < len(q["options"])):
            raise ValueError("alternativa inválida")

        correct = (not timed_out) and option == q["correct_index"]
        if correct:
            self.score += POINTS_PER_HIT
        self.results.append({"correct": correct, "timed_out": timed_out})
        self.answered = True
        return {
            "correct": correct,
            "timed_out": timed_out,
            "correct_index": q["correct_index"],
            "answer": q["answer"],
            "prompt": q["prompt"],
            "gained": POINTS_PER_HIT if correct else 0,
            "score": self.score,
        }

    def next(self, now=None):
        """Avança. Retorna a próxima pergunta ou None se a partida terminou."""
        if self.finished or not self.answered:
            raise ValueError("responda a pergunta antes de avançar")
        if self.index + 1 >= len(self.questions):
            self.ended_at = now if now is not None else time.time()
            return None
        self.index += 1
        self.answered = False
        return self.current_public()

    def summary(self):
        total = len(self.questions)
        hits = sum(1 for r in self.results if r["correct"])
        percent = round(hits / total * 100) if total else 0
        title, tier = get_rank(percent)
        return {
            "score": self.score,
            "max_score": total * POINTS_PER_HIT,
            "hits": hits,
            "misses": total - hits,
            "percent": percent,
            "title": title,
            "tier": tier,
            "elapsed_seconds": round((self.ended_at or time.time()) - self.started_at),
        }
