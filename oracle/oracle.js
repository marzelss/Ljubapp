const firebaseConfig = {
  apiKey: "AIzaSyAhNkyI7aG6snk2hPergYyGdftBBN9M1h0",
  authDomain: "ljubapp.firebaseapp.com",
  databaseURL: "https://ljubapp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ljubapp",
  storageBucket: "ljubapp.firebasestorage.app",
  messagingSenderId: "922849938749",
  appId: "1:922849938749:web:59c06714af609e478d0954"
};


firebase.initializeApp(firebaseConfig);
const db = firebase.database();

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.querySelector(".oracle-container");

  const username = localStorage.getItem("playerName");
  if (!username) {
    container.innerHTML = `<h1>Error</h1><p>No username found.</p>`;
    return;
  }

  const userSnapshot = await db.ref(`users/${username}/points`).once("value");
  const userPoints = userSnapshot.val() ?? 0;

  const snapshot = await db.ref("oracle-game/questions").once("value");
  const data = snapshot.val();

  if (!data) {
    container.innerHTML = `<h1>Error loading game</h1>`;
    return;
  }

  let currentIndex = data.currentIndex;

  // -----------------------------
  // END-OF-GAME CHECK
  // -----------------------------
  if (currentIndex > 11) {
    container.innerHTML = `
      <h1>It's been fun playing with you! 🎉</h1>
      <p class="description">
        Unfortunately, our fun times have come to an end. But hopefully, you enjoyed the journey! Thank you for being such a great player!
      </p>
    `;
    return; // stop all further logic
  }

  const question = data[currentIndex];

  // If Martina → always show hints, skip all timing logic
  if (username === "Martina") {
    renderPage(container, question, userPoints, currentIndex, username, new Date());
    return;
  }

  if (!question || !question.timestamp) {
    showEmpty(container);
    return;
  }

  const now = new Date();
  const unlockTime = new Date(question.timestamp);
  const answered = question.answerData?.answered === true;

  if (answered || now < unlockTime) {
    showEmpty(container);
    return;
  }

  // Check 2h timeout BEFORE rendering
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const elapsed = now - unlockTime;

  if (elapsed >= twoHoursMs) {
    // Auto-submit with “No answer”
    await processAnswer("No answer", question, currentIndex, username);
    return;
  }

  renderPage(container, question, userPoints, currentIndex, username, unlockTime);
});


// ---------------------------------------------------
// EMPTY STATE
// ---------------------------------------------------
function showEmpty(container) {
  container.innerHTML = `
    <h1>No questions for you yet 💭</h1>
    <p class="description">Come back later for more activities.</p>
  `;
}

// ---------------------------------------------------
// TIME LEFT FORMATTER
// ---------------------------------------------------
function formatTimeLeft(msLeft) {
  if (msLeft <= 0) return "0m";

  const minutes = Math.floor(msLeft / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;

  if (hours > 0) return `${hours}h${remainingMin}m`;
  return `${remainingMin}m`;
}

// ---------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------
function renderPage(container, questionObj, points, index, username, unlockTime) {
  
  // SPECIAL MODE: OWNER VIEW
  if (username === "Martina") {
    // Pick 3 random hints
    const randomHints = shuffleArray(questionObj.hints).slice(0, 3);
    const randomMisleading = shuffleArray(questionObj.misleadingHints).slice(0, 3);

    container.innerHTML = `
      <h1>Help your opponents guess the answer! 🪄</h1>

      <p class="description" style="margin-bottom: 2rem;">
        Here are some helpful hints and a few misleading ones... use them wisely!
      </p>

      <h2>🔍 Real Hints</h2>
      <ul class="hint-list">
        ${randomHints.map(h => `<li>${h}</li>`).join("")}
      </ul>

      <h2 style="margin-top: 2rem;">❌ Misleading Hints</h2>
      <ul class="hint-list">
        ${randomMisleading.map(h => `<li>${h}</li>`).join("")}
      </ul>
    `;

    return;
  }

  // Original player view
  const now = new Date();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const msLeft = twoHoursMs - (now - unlockTime);
  const timeLeftStr = formatTimeLeft(msLeft);

  container.innerHTML = `
    <h1>Have you been paying attention? 👂🏻</h1>

    <p class="description">
      Listen carefully: <strong>your opponent has been dropping hints about what will come next</strong>! 🔮 <br><br>
      Gather enough information to answer the question below. You will have to choose among 4 options: <br>
      - one is the correct answer; it will win you 10 points. <br>
      - one is close to correct; this will win 5 points for both. <br>
      - the two remaining options are wrong; opponent will earn 10 points. <br><br>
      Beware: some hints are lies to mislead and deceive you! <br><br> 
      Good luck, Oracle!
    </p>

    <h2 id="pointsLabel">⏳ Time left: <span id="pointsValue">${timeLeftStr}</span></h2>

    <h2 style="margin-top: 2rem; font-size: 1.6rem;">${questionObj.question}</h2>

    <div id="answerOptions"></div>

    <button id="submitAnswer" disabled>Continue</button>
  `;

  const optionsContainer = container.querySelector("#answerOptions");
  const submitButton = container.querySelector("#submitAnswer");

  const shuffled = shuffleArray(questionObj.answers.options);
  let selected = null;

  shuffled.forEach(answer => {
    const div = document.createElement("div");
    div.className = "answer-tile";
    div.textContent = answer;

    div.addEventListener("click", () => {
      selected = answer;

      optionsContainer.querySelectorAll(".answer-tile")
        .forEach(t => t.classList.remove("checked"));

      div.classList.add("checked");
      submitButton.disabled = false;
    });

    optionsContainer.appendChild(div);
  });

  submitButton.addEventListener("click", async () => {
    if (!selected) return;

    // Reset userPoints to prevent double submission
    localStorage.setItem("userPoints", "0");

    // Prevent double submission by checking Firebase
    const currentIndexSnap = await db.ref("oracle-game/questions/currentIndex").once("value");
    const currentIndex = currentIndexSnap.val();

    if (currentIndex !== index) {
      console.warn("Double submission blocked: index mismatch");
      window.location.href = "../profile/profile.html";
      return;
    }

    // Normal flow
    await processAnswer(selected, questionObj, index, username);
  });
}

// ---------------------------------------------------
// SHARED SUBMIT LOGIC
// ---------------------------------------------------
async function processAnswer(selected, questionObj, index, username) {
  try {
    const correct = questionObj.answers.correct;
    const close = questionObj.answers.close;

    let winner = "";
    let maxPoints = 0;

    const martinaRef = db.ref("users/Martina/points");
    const martinaPointsSnap = await martinaRef.once("value");
    let martinaPoints = martinaPointsSnap.val() ?? 0;

    // Determine winner
    if (selected === correct) {
      winner = "Renato";
      maxPoints = 10;
      if (username === "Renato") localStorage.setItem("userPoints", "10");
    } else if (selected === close) {
      winner = "Both";
      maxPoints = 5;
      martinaPoints += 5;
      if (username === "Renato") localStorage.setItem("userPoints", "5");
    } else {
      winner = "Martina";
      maxPoints = 10;
      martinaPoints += 10;
      if (username === "Renato") localStorage.setItem("userPoints", "0");
    }

    await db.ref(`oracle-game/questions/${index}/gameSummary`).set({
      winner,
      maxPoints
    });

    await martinaRef.set(martinaPoints);

    await db.ref("oracle-game/questions/currentIndex").set(index + 1);

    localStorage.setItem("oracle-answer-picked", selected);
    localStorage.setItem("currentGame", `oracle-game/questions/${index}`);

    window.location.href = "../result/result.html";
  } catch (err) {
    console.error("Auto-submit error:", err);
  }
}

// ---------------------------------------------------
// SHUFFLE
// ---------------------------------------------------
function shuffleArray(arr) {
  let a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
