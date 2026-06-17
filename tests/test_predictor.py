import unittest

from evo_predict_agent.predictor import AutoMLPredictor
from evo_predict_agent.signals import extract_signals


class PredictorTest(unittest.TestCase):
    def test_predictor_returns_family(self):
        history = [
            {"family": "auth-bug", "signals": ["auth"]},
            {"family": "auth-bug", "signals": ["auth", "api-contract"]},
            {"family": "typescript-bug", "signals": ["typescript-error"]},
            {"family": "auth-bug", "signals": ["auth"]},
            {"family": "runtime-timeout", "signals": ["timeout"]},
        ]
        pred = AutoMLPredictor().predict(history, ["auth"], "401 after login")
        self.assertTrue(pred.family)
        self.assertGreaterEqual(pred.confidence, 0)
        self.assertLessEqual(pred.confidence, 1)

    def test_auth_token_refresh_is_not_timeout(self):
        signals = extract_signals("login returns 401 unauthorized after token refresh")
        self.assertIn("auth", signals)
        self.assertNotIn("timeout", signals)


if __name__ == "__main__":
    unittest.main()
