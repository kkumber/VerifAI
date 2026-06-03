# VerifAI

> AI Fact-checking Assistant

VerifAI is an AI-powered fact-checking assistant that analyzes user-submitted statements and provides verdicts, corrections, and sources to combat misinformation.

---

## Getting Started

### Cloning the Repository

Make sure you have Node.js and npm installed.

```bash
git clone https://github.com/kkumber/VerifAI
cd VerifAI
npm install
````

Create a `.env` file in the root directory:

```env
API_PORT=3000
GEMMA_API_KEY=your_google_gemma_api_key_here
CONTENT_CHAR_LIMIT=1000
```

> Replace `your_google_gemma_api_key_here` with your actual Google Gemma API key.

Run the backend:

```bash
npm start
```

The server will run at `http://localhost:3000`.

---

## Development

### API Endpoints

#### GET /health

Checks if the server is running.

```http
GET /health
```

**Response:**

```json
{
  "status": "OK"
}
```

---

#### POST /api

Submits a statement for fact-checking.

```http
POST /api
```

**Headers:**

* `Content-Type: application/json`

**Request Body:**

```json
{
  "content": "Your statement to fact-check here"
}
```

**Response:**

```json
{
  "verdict": "True" | "False" | "Partially True" | "Unverifiable",
  "errors": [
    {
      "claim": "Incorrect or misleading part of the statement",
      "correction": "Corrected information",
      "reason": "Why the original claim is incorrect",
      "source": "Credible source name",
      "url": "https://..."
    }
  ],
  "overall_reason": "Summary of fact-check verdict",
  "related_topics": ["topic1", "topic2"]
}
```

**Error Codes:**

* `400 Bad Request`: Invalid input or character limit exceeded
* `408 Request Timeout`: AI API request timed out
* `500 Internal Server Error`: Backend or AI failure

---

### Testing

You can use [Postman](https://www.postman.com/) or `curl`.

**Health Check:**

```bash
curl http://localhost:3000/health
```

**Fact-check Example:**

```bash
curl -X POST http://localhost:3000/api \
-H "Content-Type: application/json" \
-d '{"content":"The Eiffel Tower is located in Berlin and was completed in 1889."}'
```

**Sample Response:**

```json
{
  "verdict": "Partially True",
  "errors": [
    {
      "claim": "The Eiffel Tower is located in Berlin.",
      "correction": "The Eiffel Tower is located in Paris, France.",
      "reason": "The location was stated incorrectly.",
      "source": "Encyclopedia Britannica",
      "url": "https://www.britannica.com/topic/Eiffel-Tower"
    }
  ],
  "overall_reason": "The location claim is incorrect, but the completion date is accurate.",
  "related_topics": ["Eiffel Tower", "Paris"]
}
```

---

## Additional Resources

* [Google Generative AI Documentation](https://cloud.google.com/docs/generative-ai)
* [Postman](https://www.postman.com/)
* [cURL](https://curl.se/)

---

## License

[GNU General Public License v3.0](LICENSE)

---

<p align="center"><strong>netrunners</strong></p>

<p align="center">
  <a href="https://github.com/jjjayed">
    <img src="https://avatars.githubusercontent.com/u/71617423?v=4" width="96" height="96" alt="jjjayed"/>
  </a>
  <a href="https://github.com/remperazKevin">
    <img src="https://avatars.githubusercontent.com/u/67644007?v=4" width="96" height="96" alt="remperazKevin"/>
  </a>
  <a href="https://github.com/kkumber">
    <img src="https://avatars.githubusercontent.com/u/187156466?v=4" width="96" height="96" alt="kkumber"/>
  </a>
</p>

<p align="center"><em>Created by netrunners for the Sparkfest: GDG PUP Hackathon 2025</em></p>
