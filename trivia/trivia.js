// --- CONFIGURE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAhNkyI7aG6snk2hPergYyGdftBBN9M1h0",
  authDomain: "ljubapp.firebaseapp.com",
  databaseURL: "https://ljubapp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ljubapp",
  storageBucket: "ljubapp.firebasedestorage.app",
  messagingSenderId: "922849938749",
  appId: "1:922849938749:web:59c06714af609e478d0954"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- LOCAL STORAGE ---
const username = localStorage.getItem("playerName") || "Player";
localStorage.setItem("currentGame", "trivia-game");

const container = document.getElementById("exchange-container");

// Firebase refs
const gameRef = db.ref(`trivia-game`);
let questions = [];
let currentIndex = 0;
let correctAnswers = 0;

// --- END OF GAME MESSAGE ---
function showEndOfGameMessage() {
  if (username === "Martina") {
    container.innerHTML = `
      <h3 class="end-title">Congrats 🎉</h3>
      <p>
        Renato got <strong>${correctAnswers}</strong> answers right out of 7.
        It must've been hard supporting your partner all day long... get some rest now!<br>
        Love is in the air 🤍
      </p>
    `;
  } else {
    container.innerHTML = `
      <h3 class="end-title">Congrats 🎉</h3>
      <p>
        You answered all the questions!<br><br>
        Time to enjoy the rest of the evening together ❤️
        You played all the games of the day: well done!<br> 
        Time to enjoy the rest of your evening together! Go enjoy your prize...<br><br> 
        Love is in the air! 🤍
      </p>
    `;
  }
}

// --- LOAD QUESTIONS ---
async function loadQuestions() {
  const snap = await db.ref("trivia-game/questions").get();
  return snap.val() || [];
}

// --- LOAD USER STATE ---
async function loadUserState() {
  const snap = await gameRef.get();
  if (!snap.exists()) {
    await gameRef.set({
      currentIndex: 0,
      correctAnswers: 0
    });
    currentIndex = 0;
    correctAnswers = 0;
    return;
  }

  const data = snap.val();
  currentIndex = data.currentIndex || 0;
  correctAnswers = data.correctAnswers || 0;
}

// --- INIT PAGE (Renato sees game / Martina sees placeholder) ---
function renderIntro() {
  if (username === "Martina") {
    container.innerHTML = `
      <h2>Trivia Quiz 💭</h2>
      <p>
        Happy anniversary!<br>
        Support your partner — he’s playing the memory game of the year!
      </p>
    `;
    return;
  }

  container.innerHTML = `
    <h2>Trivia Quiz 💭</h2>
    <p>
      Happy anniversary! My, it's already been a year? Time to go through all the milestones together. Because you remember all of them... right?<br><br> 
      Answer all the questions correctly and... find out the prize for yourself!
    </p>
    <div id="question-container"></div>
  `;
}

// --- RENDER QUESTION ---
function renderQuestion() {
  if (username !== "Renato") return; // only Renato plays

  const questionContainer = document.getElementById("question-container");

  // If finished
  if (currentIndex >= questions.length) {
    return showEndOfGameMessage();
  }

  const q = questions[currentIndex];

  questionContainer.innerHTML = `
    <h3>${q.question}</h3>
  `;

  // Shuffle options
  const shuffled = [...q.answers.options].sort(() => Math.random() - 0.5);

  shuffled.forEach(option => {
    const tile = document.createElement("label");
    tile.className = "answer-tile";
    tile.innerHTML = `
      <input type="radio" name="answer" value="${option}">
      <span>${option}</span>
    `;
    tile.addEventListener("click", () => {
      document.querySelectorAll(".answer-tile").forEach(t => t.classList.remove("checked"));
      tile.classList.add("checked");
      tile.querySelector("input").checked = true;
    });
    questionContainer.appendChild(tile);
  });

  // Button
  const btn = document.createElement("button");
  btn.textContent = currentIndex === questions.length - 1 ? "Submit" : "Continue >";
  questionContainer.appendChild(btn);

  btn.addEventListener("click", async () => {
    const selected = document.querySelector('input[name="answer"]:checked');
    if (!selected) return alert("Please select an answer!");

    const isCorrect = selected.value === q.answers.correct;

    // Popup message
    alert(isCorrect ? q.successMessage : q.failureMessage);

    // Update Firebase
    correctAnswers = correctAnswers + (isCorrect ? 1 : 0);
    currentIndex++;

    await gameRef.update({
      currentIndex,
      correctAnswers
    });

    // Last one → show end message
    if (currentIndex >= questions.length) {
      showEndOfGameMessage();
      return;
    }

    renderQuestion();
  });
}

// --- MAIN ---
(async function start() {
  renderIntro();

  await loadUserState();
  questions = await loadQuestions();

  if (username === "Martina" && currentIndex >= questions.length) {
    showEndOfGameMessage();
    return;
  }

  if (username === "Renato") {
    renderQuestion();
  }
})();
