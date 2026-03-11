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

const username = (localStorage.getItem("playerName") || "Player").toLowerCase();
const menuContainer = document.getElementById("menu-container");

// --- Load plates JSON ---
async function loadPlates() {
  const response = await fetch("../files/plates.json");
  return await response.json();
}

// --- Reusable navigation button ---
function createNavigationButton() {
  const btn = document.createElement("button");
  btn.textContent = "Return to navigation";
  btn.addEventListener("click", () => (window.location.href = "../navigation.html"));
  return btn;
}

// --- Martina view ---
async function showMartinaMenu() {
  const menuData = await db.ref("menu").get().then(snap => snap.val() || {});
  const hasUnrated = Object.values(menuData).some(v => !v.rated);

  if (hasUnrated) {
    const stopCard = document.createElement("div");
    stopCard.className = "stop-card";
    stopCard.innerHTML = `
      <div class="stop-icon">⚠️</div>
      <p>Let Renato rate his latest plate first</p>
    `;
    stopCard.appendChild(createNavigationButton());
    menuContainer.appendChild(stopCard);
    return;
  }

  const plates = await loadPlates();

  if (!plates.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No plates available right now.";
    menuContainer.append(empty, createNavigationButton());
    return;
  }

  const title = document.createElement("h2");
  title.textContent = "What will you cook tonight?";
  menuContainer.appendChild(title);

  let selectedPlate = null;

  plates.forEach(plate => {
    const tile = document.createElement("label");
    tile.className = "ingredient";
    tile.innerHTML = `
      <input type="radio" name="plate" value="${plate.id}" />
      <span>${plate.name}</span>
    `;
    tile.addEventListener("click", () => {
      document.querySelectorAll(".ingredient").forEach(t => t.classList.remove("checked"));
      tile.classList.add("checked");
      tile.querySelector("input").checked = true;
      selectedPlate = plate.id;
    });
    menuContainer.appendChild(tile);
  });

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.onclick = () => {
    if (!selectedPlate) return alert("Please select a plate!");
    db.ref(`menu/${selectedPlate}`).set({
      timestamp: new Date().toISOString(),
      rated: false,
      comments: ""
    }).then(() => alert("Plate saved!"));
  };
  menuContainer.appendChild(saveBtn);
}

// --- Renato view ---
async function showRenatoMenu() {
  const menuData = await db.ref("menu").get().then(snap => snap.val() || {});
  const unrated = Object.entries(menuData).find(([_, v]) => !v.rated);

  if (!unrated) {
    const emptyImg = document.createElement("img");
    emptyImg.src = "../assets/plates/000empty.png";
    emptyImg.className = "empty-image";
    menuContainer.appendChild(emptyImg);

    const title = document.createElement("h2");
    title.textContent = "Nothing to see here";
    menuContainer.appendChild(title);

    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Today's menu is not available yet! Try again later.";
    menuContainer.append(emptyState, createNavigationButton());
    return;
  }

  const [plateId, plate] = unrated;
  const plates = await loadPlates();
  const plateInfo = plates.find(p => p.id === plateId);

  // Create a content wrapper (to hide after submit)
  const contentWrapper = document.createElement("div");
  contentWrapper.id = "content";
  menuContainer.appendChild(contentWrapper);

  const menuTitle = document.createElement("h2");
  menuTitle.textContent = "Menu";
  contentWrapper.appendChild(menuTitle);

  if (plateInfo?.image) {
    const img = document.createElement("img");
    img.src = plateInfo.image;
    img.style.width = "200px";
    img.style.borderRadius = "12px";
    img.style.marginBottom = "10px";
    contentWrapper.appendChild(img);
  }

  const nameEl = document.createElement("p");
  nameEl.className = "plate-name";
  nameEl.textContent = plateInfo?.name || plateId;
  contentWrapper.appendChild(nameEl);

  const q = document.createElement("h2");
  q.textContent = "How would you rate your dish?";
  q.style.fontWeight = "500";
  q.style.fontSize = "1.2rem";
  contentWrapper.appendChild(q);

  const starsDiv = document.createElement("div");
  starsDiv.className = "stars";
  let rating = 0;
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("span");
    star.textContent = "★";
    star.addEventListener("click", () => {
      rating = i;
      starsDiv.querySelectorAll("span").forEach((s, j) => {
        s.classList.toggle("selected", j < i);
      });
    });
    starsDiv.appendChild(star);
  }
  contentWrapper.appendChild(starsDiv);

  const textarea = document.createElement("textarea");
  textarea.placeholder = "Additional comments...";
  contentWrapper.appendChild(textarea);

  const submitBtn = document.createElement("button");
  submitBtn.textContent = "Submit";
  submitBtn.addEventListener("click", async () => {
    if (!rating) return alert("Please rate the dish!");

    // hide content immediately
    contentWrapper.classList.add("fade-out");

    await db.ref(`menu/${plateId}`).update({
      rated: true,
      rating,
      comments: textarea.value || "",
    });

    alert("Thank you for your feedback!");
    setTimeout(() => (window.location.href = "../navigation.html"), 800);
  });
  contentWrapper.appendChild(submitBtn);
}

// --- Main ---
if (username === "martina") {
  showMartinaMenu();
} else if (username === "renato") {
  showRenatoMenu();
}
