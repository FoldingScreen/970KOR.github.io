// SABANA Firestore connection patch
// GitHub Pages / 일부 브라우저에서 Firestore WebChannel CORS 문제가 발생할 수 있어
// Firestore를 실제로 사용하기 전에 long polling을 자동 감지하도록 설정한다.
(function () {
  if (window.__sabanaFirestoreSettingsPatchV1) return;
  window.__sabanaFirestoreSettingsPatchV1 = true;

  if (typeof firebase === "undefined" || !firebase.firestore) return;

  try {
firebase.firestore().settings({
  experimentalForceLongPolling: true,
  useFetchStreams: false,
  merge: true,
});
  } catch (err) {
    console.warn("Firestore long polling settings skipped", err);
  }
})();
