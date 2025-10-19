# Translator & Islamic Info API Backend

This is the backend server for a multi-functional application that provides AI-powered translation services, user authentication, and an API for retrieving Islamic-related information such as prayer times, Duas, and the 99 Names of Allah.

## ✨ Features

-   **User Authentication**: Secure user registration and login using JWT (JSON Web Tokens).
-   **Speech-to-Text**: Converts spoken audio into text using Google Cloud Speech-to-Text.
-   **Text-to-Speech**: Converts text into natural-sounding speech using Google Cloud Text-to-Speech.
-   **Islamic Data API**:
    -   Get daily prayer times for any location.
    -   Fetch lists of Duas (supplications).
    -   Retrieve the 99 Names of Allah (Asma-ul-Husna).
    -   Search the Quran.
-   **Rate Limiting**: Protects the API from brute-force attacks and abuse.

## 🛠️ Tech Stack

-   **Backend**: Node.js, Express.js
-   **Database**: MongoDB with Mongoose ODM
-   **Authentication**: `bcryptjs` for password hashing, `jsonwebtoken` for access tokens
-   **AI Services**:
    -   `@google-cloud/speech`
    -   `@google-cloud/text-to-speech`
-   **Validation**: `express-validator` for input sanitation and validation

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v16 or later)
-   [MongoDB](https://www.mongodb.com/try/download/community) installed and running, or a MongoDB Atlas connection string.
-   A Google Cloud Platform account with the Speech-to-Text and Text-to-Speech APIs enabled.

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone <your-repository-url>
    cd translator-backend
    ```

2.  **Install NPM packages:**
    ```sh
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add the following variables.

    ```env
    # Server Configuration
    PORT=3000

    # MongoDB Configuration
    MONGO_URI=mongodb://localhost:27017/your_db_name
    DB_NAME=your_db_name

    # JWT Authentication
    JWT_SECRET=your_super_secret_jwt_key

    # Google Cloud Credentials
    # This should be the path to your Google Cloud service account JSON key file.
    GOOGLE_APPLICATION_CREDENTIALS=./path-to-your-gcp-keyfile.json
    ```

### Running the Application

-   **For development (with automatic restarts):**
    ```sh
    npm run dev
    ```

-   **For production:**
    ```sh
    npm start
    ```

The server will be accessible at `http://localhost:3000`.

## ⚙️ API Endpoints

Here is a summary of the main available API routes.

| Method | Endpoint                  | Description                               | Access    |
| :----- | :------------------------ | :---------------------------------------- | :-------- |
| `POST` | `/api/auth/register`      | Register a new user.                      | Public    |
| `POST` | `/api/auth/login`         | Log in an existing user and get a token.  | Public    |
| `GET`  | `/api/auth/me`            | Get the profile of the logged-in user.    | Private   |
| `POST` | `/speech-to-text`         | Transcribe an audio file to text.         | Public    |
| `POST` | `/text-to-speech`         | Convert text into an audio file.          | Public    |
| `GET`  | `/api/prayer-times`       | Get prayer times for a specific location. | Public    |
| `GET`  | `/api/duas`               | Get a list of all Duas.                   | Public    |
| `GET`  | `/api/names`              | Get the 99 Names of Allah.                | Public    |
| `GET`  | `/api/quran/search?q=`    | Search the Quran for a specific term.     | Public    |

---