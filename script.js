async function submitRuinsParty(){
  if(!state.isAdmin){
    alert("권한이 없습니다.");
    return;
  }

  const side = document.getElementById("holySwordSideSelect")?.value || "KOR";

  const m = Number(el.utcMonth.value);
  const d = Number(el.utcDay.value);
  const h = Number(el.utcHour.value);

  if(!m || !d || h < 0 || h > 23){
    alert("UTC 날짜/시간을 선택하세요.");
    return;
  }

  const year = new Date().getUTCFullYear();
  const utcDate = new Date(Date.UTC(year, m-1, d, h, 0, 0, 0));

  // ✅ KST 계산
  const kstHour = (h + 9) % 24;

  // ✅ 자동 이름 생성
  const sideText = side === "KOR" ? "본연맹" : "아카데미";

  const autoName = `[${sideText}] ${kstHour}시(UTC ${String(h).padStart(2,"0")}:00)`;

  await partiesRef(state.currentEventId).add({
    type: state.currentEventId,
    event: state.currentEventId,
    name: autoName,
    side,
    createdBy: state.currentUser,
    members: [],
    rallyLeader: "",
    maxMembers: 30,
    timeUTC: utcDate,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  closeRuinsCreateModal();
}
