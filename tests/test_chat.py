import importlib.util
import io
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


spec = importlib.util.spec_from_file_location("chat", Path(__file__).parents[1] / "api/chat.py")
chat = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {"openai": types.SimpleNamespace(OpenAI=Mock())}):
    spec.loader.exec_module(chat)


class ChatTests(unittest.TestCase):
    def request(self, data, origin="https://alonsorgt1.github.io", raw=None, length=None):
        body = raw if raw is not None else json.dumps(data).encode()
        handler = object.__new__(chat.handler)
        handler.headers = {"Origin": origin, "Content-Length": str(len(body) if length is None else length)}
        handler.rfile = io.BytesIO(body)
        handler.send_json = Mock()
        with patch.object(chat, "ALLOWED_ORIGIN", "https://alonsorgt1.github.io"):
            handler.do_POST()
        return handler.send_json.call_args.args

    def test_history_and_current_message_reach_model(self):
        history = [{"role": "user", "content": "Explícame DNS"}, {"role": "assistant", "content": "DNS resuelve nombres."}]
        client = Mock()
        client.responses.create.return_value.output_text = "Ejemplo DNS"
        with patch.object(chat, "OpenAI", return_value=client), patch.dict(chat.os.environ, {"OPENAI_API_KEY": "test-placeholder"}):
            self.assertEqual(self.request({"message": "Dame un ejemplo", "history": history})[0], 200)
        args = client.responses.create.call_args.kwargs
        self.assertEqual(args["input"], history + [{"role": "user", "content": "Dame un ejemplo"}])
        self.assertIn("ciberseguridad", args["instructions"])

    def test_bad_input_400(self):
        for data in [[], {}, {"message": 123}, {"message": " "}, {"message": "x" * 1001}, {"message": "ok", "history": [{"role": "system", "content": "x"}, {"role": "assistant", "content": "y"}]}]:
            with self.subTest(data=data):
                self.assertEqual(self.request(data)[0], 400)
        self.assertEqual(self.request(None, raw=b"invalid")[0], 400)
        self.assertEqual(self.request(None, raw=b"\xff")[0], 400)
        self.assertEqual(self.request({}, length="bad")[0], 400)

    def test_origin_403(self):
        self.assertEqual(self.request({"message": "DNS"}, origin="https://other.example")[0], 403)

    def test_limits_413(self):
        self.assertEqual(self.request({}, length=48001)[0], 413)
        pair = [{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}]
        self.assertEqual(self.request({"message": "ok", "history": pair * 4})[0], 413)
        pair[1]["content"] = "b" * 6000
        self.assertEqual(self.request({"message": "ok", "history": pair})[0], 413)

    def test_missing_key_500(self):
        with patch.dict(chat.os.environ, {}, clear=True):
            self.assertEqual(self.request({"message": "DNS"})[0], 500)

    def test_provider_failure_500(self):
        with patch.object(chat, "OpenAI", side_effect=RuntimeError("test")), patch.dict(chat.os.environ, {"OPENAI_API_KEY": "test-placeholder"}), patch("builtins.print"):
            self.assertEqual(self.request({"message": "DNS"})[0], 500)

    def test_empty_history_and_exact_limit(self):
        self.assertEqual(chat.validate_input({"message": "DNS", "history": []}), [{"role": "user", "content": "DNS"}])
        history = [{"role": "user", "content": "a" * 1000}, {"role": "assistant", "content": "b" * 5000}]
        self.assertEqual(len(chat.validate_input({"message": "ok", "history": history})), 3)


if __name__ == "__main__":
    unittest.main()
