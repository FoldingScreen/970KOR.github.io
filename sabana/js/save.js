const firebaseConfig = {
  apiKey: "AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",
  authDomain: "kor-app-fa47e.firebaseapp.com",
  projectId: "kor-app-fa47e",
  storageBucket: "kor-app-fa47e.firebasestorage.app",
  messagingSenderId: "397749083935",
  appId: "1:397749083935:web:51c7c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let linkedUser = "";
let metaReady = false;

function getLinkedUser() {
  return String(localStorage.getItem("partyAppUser") || "").trim();
}

function sabanaUserRef() {
  return db.collection("events").doc(SABANA_EVENT_ID).collection("users").doc(linkedUser);
}

function defaultMeta() {
  const upgrades = {};
  Object.values(LABS).flat().forEach(([id]) => upgrades[id] = 0);
  return { coins: 0, bestTimeMs: 0, bestKills: 0, totalCoins: 0, upgrades };
}

async function loadMetaFromFirestore() {
  linkedUser = getLinkedUser();
  if (!linkedUser) {
    alert("970KOR 로그인 후 이용할 수 있습니다.");
    location.href = "../";
    return defaultMeta();
  }

  const ref = sabanaUserRef();
  const snap = await ref.get();
  if (!snap.exists) {
    const fresh = defaultMeta();
    await ref.set({
      nickname: linkedUser,
      ...fresh,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return fresh;
  }

  const base = defaultMeta();
  const saved = snap.data() || {};
  return {
    ...base,
    ...saved,
    upgrades: { ...base.upgrades, ...(saved.upgrades || {}) }
  };
}

async function saveMeta() {
  if (!linkedUser) return;
  try {
    await sabanaUserRef().set({
      nickname: linkedUser,
      coins: Number(meta.coins || 0),
      bestTimeMs: Number(meta.bestTimeMs || 0),
      bestKills: Number(meta.bestKills || 0),
      totalCoins: Number(meta.totalCoins || 0),
      upgrades: meta.upgrades || {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error("SABANA 저장 실패", err);
    if (typeof showToast === "function") showToast("저장 실패: 네트워크를 확인하세요.");
  }
}
