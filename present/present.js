/* --------------------------------------------------
   FIREBASE SETUP
-------------------------------------------------- */
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

const username = localStorage.getItem("playerName") || "Player";
localStorage.setItem("currentGame", "present-game");

const container = document.getElementById("present-container");

// Database refs
const gameRef = db.ref("present-game");
const usersRef = db.ref("users");

// Data
let gameData = {};
let currentIndex = 0;

/* --------------------------------------------------
   LIVE LISTENER FOR GAME STATE (AUTO UPDATES)
-------------------------------------------------- */
gameRef.on("value", (snap) => {
  if (!snap.exists()) return;

  gameData = snap.val();
  currentIndex = gameData.currentIndex || 0;

  // If Renato should see a prompt (from Martina)
  if (username === "Renato" && gameData.lastResultMessage) {
    alert(gameData.lastResultMessage);

    // Clear message so it doesn't show again
    gameRef.update({ lastResultMessage: "" });
  }

  renderPage(); // always refresh UI
});

/* --------------------------------------------------
   RENDER PAGE
-------------------------------------------------- */
async function renderPage() {
  const entry = gameData[currentIndex];

  if (!entry) {
    const correctRef = gameRef.child("correctAnswers");
    const correctSnap = await correctRef.get();
    const correctAnswers = correctSnap.val() || 0;
    container.innerHTML = `<h2>Guess the present 🎁</h2><p>Congrats! You completed the game! <br><br> You guessed ${correctAnswers} gifts out of 7.</p>`;
    return;
  }

  container.innerHTML = `<h2>Guess the present 🎁</h2>`;

  if (username === "Renato") {
    container.innerHTML += `
      <p>
        Can you guess which present is which?<br><br>
        Here's a little hint: pick the present that you think matches this description!
      </p>
      <h3>${entry.hint || "No hint available"}</h3>
    `;
  } else if (username === "Martina") {
    container.innerHTML += `
      <p>
        Don't let your partner see this!<br>
        Here's the answer to the question — make sure they guess it right...
      </p>

      <h3>${entry.answer}</h3>

      <p class="footer-text">Did Renato guess the present?</p>

      <button id="btn-correct">He guessed it!</button>
      <button id="btn-wrong" class="secondary-btn">He didn't guess...</button>
    `;

    setupMartinaButtons();
  }
}

/* --------------------------------------------------
   BUTTON LOGIC FOR MARTINA
-------------------------------------------------- */
function setupMartinaButtons() {
  const correctBtn = document.getElementById("btn-correct");
  const wrongBtn = document.getElementById("btn-wrong");

  correctBtn.addEventListener("click", () => {
    handleResult("Renato", "Congrats! You guessed it! 🎉");
  });

  wrongBtn.addEventListener("click", () => {
    handleResult("Martina", "Sorry! You lost 🥲");
  });
}

/* --------------------------------------------------
   HANDLE BUTTON RESULT
   winnerName = "Renato" or "Martina"
-------------------------------------------------- */
async function handleResult(winnerName, messageForRenato) {
  try {
    // 1. Increase winner points
    const userPointsRef = usersRef.child(`${winnerName}/points`);
    const pointsSnap = await userPointsRef.get();
    const oldPoints = pointsSnap.val() || 0;
    await userPointsRef.set(oldPoints + 1);

    // 2. Save winner under the current question
    const winnerRef = gameRef.child(`${currentIndex}/winner`);
    await winnerRef.set(winnerName);

    // 3. Update correctAnswers ONLY when Renato wins
    if (winnerName === "Renato") {
      const correctRef = gameRef.child("correctAnswers");
      const correctSnap = await correctRef.get();
      const oldCorrect = correctSnap.val() || 0;
      await correctRef.set(oldCorrect + 1);
    }

    // 4. Move to next index
    const newIndex = currentIndex + 1;

    await gameRef.update({
      currentIndex: newIndex,
      lastResultMessage: messageForRenato
    });

    // live listener will re-render automatically
  } catch (error) {
    console.error("Error handling result:", error);
  }
}

