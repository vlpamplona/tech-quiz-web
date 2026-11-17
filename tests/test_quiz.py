"""Testes: python -m unittest discover -s tests -v"""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import quiz_logic
from quiz_data import TERMS

# não suja o historico.json real durante os testes
quiz_logic.HISTORY_FILE = Path(tempfile.mkdtemp()) / "historico.json"

import app as app_module  # noqa: E402


class LogicTests(unittest.TestCase):
    def test_banco(self):
        self.assertGreaterEqual(len(TERMS), 100)
        self.assertEqual(len({t["category"] for t in TERMS}), 8)
        self.assertEqual(len({t["pt"] for t in TERMS}), len(TERMS))
        self.assertEqual(len({t["en"] for t in TERMS}), len(TERMS))

    def test_build_quiz(self):
        for _ in range(300):
            qs, _ = quiz_logic.build_quiz(15, [])
            self.assertEqual(len(qs), 15)
            self.assertEqual(len({q["id"] for q in qs}), 15)
            for q in qs:
                self.assertEqual(len(set(q["options"])), 4)
                self.assertEqual(q["options"][q["correct_index"]], q["answer"])
                self.assertEqual(TERMS[q["id"]]["en"], q["answer"])

    def test_rodizio(self):
        seen, used = [], set()
        for _ in range(len(TERMS) // 15):
            qs, seen = quiz_logic.build_quiz(15, seen)
            for q in qs:
                self.assertNotIn(q["id"], used)
                used.add(q["id"])
        qs, _ = quiz_logic.build_quiz(15, seen)  # ciclo recomeça sem quebrar
        self.assertEqual(len({q["id"] for q in qs}), 15)

    def test_posicao_correta_varia(self):
        pos = set()
        for _ in range(100):
            pos |= {q["correct_index"] for q in quiz_logic.build_quiz(15, [])[0]}
        self.assertEqual(pos, {0, 1, 2, 3})

    def test_pontuacao_e_bloqueios(self):
        g = quiz_logic.Game(quiz_logic.build_quiz(15, [])[0])
        c = g.questions[0]["correct_index"]
        self.assertEqual(g.answer(c)["gained"], 100)
        with self.assertRaises(ValueError):
            g.answer(c)  # resposta duplicada
        g.next()
        self.assertFalse(g.answer((g.questions[1]["correct_index"] + 1) % 4)["correct"])
        g.next()
        r = g.answer(None)  # tempo esgotado
        self.assertTrue(r["timed_out"] and r["gained"] == 0)
        self.assertEqual(g.score, 100)
        with self.assertRaises(ValueError):
            g.answer(True)  # tipo inválido (bool)
        with self.assertRaises(ValueError):
            g.next() and g.answer(9)

    def test_ranking_limites(self):
        tiers = [quiz_logic.get_rank(p)[1] for p in (0, 39, 40, 69, 70, 89, 90, 100)]
        self.assertEqual(tiers, ["low", "low", "mid", "mid", "great", "great", "master", "master"])


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.c = app_module.app.test_client()

    def play(self, hits):
        r = self.c.post("/api/start").get_json()
        gid, q = r["game"], r["question"]
        game = app_module.GAMES[gid]
        self.assertNotIn("correct_index", q)  # resposta não vaza antes de responder
        for i in range(15):
            right = game.questions[i]["correct_index"]
            opt = right if i < hits else (right + 1) % 4
            a = self.c.post("/api/answer", json={"game": gid, "option": opt}).get_json()
            self.assertEqual(a["correct"], i < hits)
            n = self.c.post("/api/next", json={"game": gid}).get_json()
        self.assertTrue(n["finished"])
        return n["summary"]

    def test_pagina_inicial(self):
        html = self.c.get("/").get_data(as_text=True)
        self.assertIn("COMEÇAR DESAFIO", html)
        self.assertIn("20s", html)

    def test_partida_completa(self):
        s = self.play(10)
        self.assertEqual((s["score"], s["hits"], s["misses"], s["percent"], s["tier"]), (1000, 10, 5, 67, "mid"))
        self.assertEqual(s["max_score"], 1500)
        self.assertEqual(self.play(15)["tier"], "master")
        self.assertEqual(self.play(0)["score"], 0)

    def test_reinicio_zera(self):
        a = self.c.post("/api/start").get_json()
        b = self.c.post("/api/start").get_json()
        self.assertNotEqual(a["game"], b["game"])
        self.assertEqual(b["question"]["score"], 0)
        self.assertEqual(b["question"]["number"], 1)

    def test_erros_da_api(self):
        self.assertEqual(self.c.post("/api/answer", json={"game": "x", "option": 0}).status_code, 404)
        gid = self.c.post("/api/start").get_json()["game"]
        self.assertEqual(self.c.post("/api/next", json={"game": gid}).status_code, 400)  # não respondeu
        self.assertEqual(self.c.post("/api/answer", json={"game": gid, "option": 99}).status_code, 400)
        self.assertEqual(self.c.post("/api/answer", json={"game": gid, "option": "0"}).status_code, 400)
        self.assertEqual(self.c.post("/api/answer", json={"game": gid, "option": 0}).status_code, 200)
        self.assertEqual(self.c.post("/api/answer", json={"game": gid, "option": 0}).status_code, 400)  # duplicada


if __name__ == "__main__":
    unittest.main()
