## 2026-06-01

- Updated `apps/api/app/chat_rag.py` so the system prompt still requires the JSON `answer`/`citations` envelope, keeps bracketed citations adjacent to supported claims, and now explicitly encourages concise Markdown plus Markdown tables when they improve clarity.
- Extended `apps/api/tests/test_chat_rag.py` to lock the prompt wording around JSON mode, concise Markdown, Markdown tables, and inline citation placement.
