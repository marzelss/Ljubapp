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

// --- LOCAL STORAGE SETUP ---
const username = localStorage.getItem("playerName") || "Player";
localStorage.setItem("userPoints", 0); // reset to prevent double points
localStorage.setItem("currentGame", "exchange-game");

const container = document.getElementById("exchange-container");

// --- GLOBAL REFERENCES ---
let userRef = db.ref(`exchange-game/${username}`);
let userSnap = null;
let questions = [];
let currentQuestion = null;
let currentIndex = 0;

// --- HANDLE EMPTY STATE ---
function showEndOfGameMessage(container) {
  container.innerHTML = `
    <h2>Thank you for playing! 🎉</h2>
    <p>
      It was fun playing with you! But don’t sleep just yet:<br>
      there may be more quizzes in your future… who knows?<br><br>
      Keep studying for your next tests — they won’t be as easy again! 📚
    </p>
  `;
}

// --- LOAD QUESTIONS JSON FROM FIREBASE ---
async function loadQuestions() {
  const snap = await db.ref("exchange-game/questions").get();
  return snap.val();
}

// --- INITIALIZE USER GAME FOLDER IF NEEDED ---
async function initializeUserGame() {
  userSnap = await userRef.get();
  if (!userSnap.exists()) {
    await userRef.set({
      timestamp: null,
      currentIndex: 0,
      correctAnswers: 0
    });
    userSnap = await userRef.get(); // refresh
  }
  currentIndex = userSnap.val().currentIndex || 0;
}

// --- CHECK GAME SUMMARY REDIRECT ---
async function checkGameSummary() {
  // Check if gameSummary exists; if not, one of the two players hasn't finished playing
  const summarySnap = await db.ref("exchange-game/gameSummary").get();
  if (!summarySnap.exists()) return false;

  // Retrieve winner and claimed status
  const summary = summarySnap.val();
  const winner = summary.winner;
  const hasClaimed = summary.claimedBy?.[username] === true;

  if (!hasClaimed) {
    // Winner has NOT claimed points yet
    if (winner === username) {
      localStorage.setItem("userPoints", 10);
      window.location.href = "../result/result.html";
      return true;
    // Loser hasn't seen result yet
    } else {
      localStorage.setItem("userPoints", 0);
      window.location.href = "../result/result.html";
      return true;
    }
  }

  // Users have already viewed results: show empty state
  showEndOfGameMessage(container);
  return true;
}

// --- CHECK IF BOTH USERS FINISHED AND DETERMINE WINNER ---
async function checkEndGame() {
  
  const summaryHandled = await checkGameSummary();
  if (summaryHandled) return;
  
  const [mSnap, rSnap] = await Promise.all([
    db.ref("exchange-game/Martina").get(),
    db.ref("exchange-game/Renato").get()
  ]);

  if (!mSnap.exists() || !rSnap.exists()) return;

  const M = mSnap.val();
  const R = rSnap.val();

  const Mdone = M.currentIndex > 14;
  const Rdone = R.currentIndex > 14;
  if (!Mdone || !Rdone) return; // both not finished

  // Determine winner
  let winner = null;
  let maxPoints = null;
  if (M.correctAnswers > R.correctAnswers) {
    winner = "Martina";
    maxPoints = M.correctAnswers;
  } else if (R.correctAnswers > M.correctAnswers) {
    winner = "Renato";
    maxPoints = R.correctAnswers;
  } else {
    winner = (new Date(M.timestamp) < new Date(R.timestamp)) ? "Martina" : "Renato";
    maxPoints = winner === "Martina" ? M.correctAnswers : R.correctAnswers;
  }

  const summaryRef = db.ref("exchange-game/gameSummary");
  const summarySnap = await summaryRef.get();
  
  if (!summarySnap.exists()) {
    await summaryRef.set({ winner, maxPoints });
  }
  
  // Winner gets exactly 10 points. Loser gets 0.
  localStorage.setItem("userPoints", winner === username ? 10 : 0);
  
  // Redirect to result (winner can claim)
  window.location.href = "../result/result.html";

}

// --- RENDER INTRO TEXT ---
function renderIntro() {
  container.innerHTML = `
    <h2>Cultural exchange 🗺️</h2>
    <p>
      How well do you know your partner's language?<br><br>
      Find out through this little quiz. The first to finish the quiz with the most correct answers, wins 10 points!
    </p>
    <div id="question-container"></div>
  `;
}

// --- RENDER QUESTION UI ---
function shuffle(array) {
  return array
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

function renderQuestion() {
  if (!questions.length) return;

  currentQuestion = questions[currentIndex];

  const userAnswers = currentQuestion.answers[username];
  const questionText = currentQuestion.question.replace("%@", userAnswers.language);

  const questionContainer = document.getElementById("question-container");
  questionContainer.innerHTML = "";

  // Question header
  const qHeader = document.createElement("h2");
  qHeader.textContent = questionText;
  questionContainer.appendChild(qHeader);

  // Answer tiles
  const shuffledOptions = shuffle([...userAnswers.options]);
  shuffledOptions.forEach(option => {
    const tile = document.createElement("label");
    tile.className = "answer-tile";
    tile.innerHTML = `
      <input type="radio" name="answer" value="${option}" />
      <span>${option}</span>
    `;
    tile.addEventListener("click", () => {
      document.querySelectorAll(".answer-tile").forEach(t => t.classList.remove("checked"));
      tile.classList.add("checked");
      tile.querySelector("input").checked = true;
    });
    questionContainer.appendChild(tile);
  });

  // Submit / Continue button
  const submitBtn = document.createElement("button");

  // If user already finished (currentIndex > last index)
  if (currentIndex >= questions.length) {
    submitBtn.textContent = "Waiting for opponent...";
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.2";
  } else {
    submitBtn.textContent = currentIndex === questions.length - 1 ? "Submit" : "Continue >";
  }
  
  questionContainer.appendChild(submitBtn);

  // --------------------------------------
  // --- CLICK EVENT FOR SUBMIT BUTTON ---
  // --------------------------------------
  submitBtn.addEventListener("click", async () => {
    submitBtn.disabled = true; // prevent double taps - TODO: button should be disabled also if page loads and user currentIndex > 14

    const selected = document.querySelector('input[name="answer"]:checked');
    if (!selected) {
      submitBtn.disabled = false;
      return alert("Please select an answer!");
    }
    
    // Extract useful info
    const userAnswers = currentQuestion.answers[username];
    const isCorrect = selected.value === userAnswers.correct;
    
    // Update Firebase values
    const newCorrectAnswers = userSnap.val().correctAnswers + (isCorrect ? 1 : 0);
    currentIndex = userSnap.val().currentIndex + 1;
    
    await userRef.update({
      timestamp: new Date().toISOString(),
      currentIndex,
      correctAnswers: newCorrectAnswers
    });
    userSnap = await userRef.get(); // refresh snapshot
    
    // -----------------------------
    //     CASE 1 — SECOND LAST
    // -----------------------------
    if (currentIndex === questions.length - 1) {
      submitBtn.textContent = "Submit";
      // Load next question normally
      currentQuestion = questions[currentIndex];
      renderQuestion();
      return;
    }
    
    // -----------------------------
    //     CASE 2 — LAST QUESTION
    // -----------------------------
    if (currentIndex >= questions.length) {
      submitBtn.textContent = "Waiting for opponent...";
      submitBtn.style.opacity = "0.2";
      submitBtn.disabled = true;
      // check if winner was already selected
      const summaryHandled = await checkGameSummary();
      if (summaryHandled) return;
      // if not, check if both players are done with the game
      await checkEndGame();
      return;
    }
    
    // -----------------------------
    //     CASE 3 — ANY OTHER QUESTION
    // -----------------------------
    currentQuestion = questions[currentIndex];
    renderQuestion();
  });
}

// Firebase live listeners
function startLiveEndgameWatcher() {
  db.ref("exchange-game").on("value", async snapshot => {
    const data = snapshot.val();
    if (!data) return;

    const M = data.Martina;
    const R = data.Renato;

    // Only proceed if both exist
    if (!M || !R) return;

    const Mdone = M.currentIndex > 14;
    const Rdone = R.currentIndex > 14;

    // When both finished, check game summary
    if (Mdone && Rdone) {
      // check if winner was already selected
      const summaryHandled = await checkGameSummary();
      if (summaryHandled) return;
      // if not, check if both players are done with the game
      await checkEndGame();
    }
  });
}

// --- MAIN EXECUTION ---
(async function start() {
  renderIntro();
  // check if user snapshots exist
  await initializeUserGame();
  startLiveEndgameWatcher();
  // check if winner was already selected
  const summaryHandled = await checkGameSummary();
  if (summaryHandled) return;
  // if not, check if both players are done with the game
  await checkEndGame();
  // if not, load questions
  questions = await loadQuestions();
  renderQuestion();
})();
