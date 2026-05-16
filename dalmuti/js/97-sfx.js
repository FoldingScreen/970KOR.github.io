(() => {
  "use strict";

  const STORAGE_KEY = "dalmutiSfxMuted";
  let ctx = null;
  let unlocked = false;
  let lastSystemText = "";
  let lastMessageText = "";
  let lastSelectedText = "";

  function isMuted() {
    return localStorage.getItem(STORAGE_KEY) === "1";
  }

  function setMuted(value) {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    updateButton();
  }

  function ensureAudio() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    return ctx;
  }

  function unlockAudio() {
    const audio = ensureAudio();
    if (!audio || unlocked) return;
    if (audio.state === "suspended") audio.resume().catch(() => null);
    unlocked = true;
  }

  function tone(freq, start, duration, gain, type = "sine", dest = null) {
    const audio = ensureAudio();
    if (!audio || isMuted()) return;

    const osc = audio.createOscillator();
    const g = audio.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audio.currentTime + start);
    g.gain.setValueAtTime(0.0001, audio.currentTime + start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), audio.currentTime + start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration);

    osc.connect(g);
    g.connect(dest || audio.destination);

    osc.start(audio.currentTime + start);
    osc.stop(audio.currentTime + start + duration + 0.02);
  }

  function noise(start, duration, gain) {
    const audio = ensureAudio();
    if (!audio || isMuted()) return;

    const bufferSize = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }

    const src = audio.createBufferSource();
    const g = audio.createGain();
    const filter = audio.createBiquadFilter();

    filter.type = "highpass";
    filter.frequency.value = 900;
    g.gain.setValueAtTime(gain, audio.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration);

    src.buffer = buffer;
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.destination);
    src.start(audio.currentTime + start);
    src.stop(audio.currentTime + start + duration + 0.02);
  }

  const SFX = {
    click() {
      tone(640, 0, 0.045, 0.035, "triangle");
    },
    ready() {
      tone(520, 0, 0.055, 0.04, "triangle");
      tone(780, 0.045, 0.075, 0.035, "triangle");
    },
    start() {
      tone(392, 0, 0.08, 0.045, "triangle");
      tone(523, 0.07, 0.08, 0.045, "triangle");
      tone(784, 0.14, 0.12, 0.045, "triangle");
    },
    play() {
      tone(720, 0, 0.045, 0.04, "square");
      tone(980, 0.035, 0.055, 0.035, "triangle");
    },
    pass() {
      tone(360, 0, 0.07, 0.035, "sawtooth");
      tone(240, 0.055, 0.09, 0.025, "sine");
    },
    select() {
      tone(480, 0, 0.035, 0.025, "triangle");
    },
    tribute() {
      tone(660, 0, 0.06, 0.035, "triangle");
      tone(520, 0.06, 0.06, 0.035, "triangle");
      tone(740, 0.12, 0.08, 0.03, "triangle");
    },
    roundEnd() {
      tone(784, 0, 0.08, 0.04, "triangle");
      tone(587, 0.075, 0.09, 0.04, "triangle");
      tone(440, 0.16, 0.13, 0.035, "triangle");
    },
    rebellion() {
      noise(0, 0.22, 0.045);
      tone(160, 0, 0.28, 0.055, "sawtooth");
      tone(220, 0.08, 0.22, 0.045, "sawtooth");
      tone(330, 0.18, 0.24, 0.04, "square");
    },
    kick() {
      tone(190, 0, 0.08, 0.05, "square");
      noise(0.03, 0.12, 0.035);
    },
    error() {
      tone(180, 0, 0.08, 0.04, "sawtooth");
      tone(160, 0.075, 0.1, 0.035, "sawtooth");
    }
  };

  function play(name) {
    if (isMuted()) return;
    unlockAudio();
    if (!unlocked) return;
    SFX[name]?.();
  }

  function updateButton() {
    const btn = document.getElementById("sfxToggleBtn");
    if (!btn) return;
    btn.textContent = isMuted() ? "효과음 꺼짐" : "효과음 켜짐";
    btn.classList.toggle("danger", isMuted());
  }

  function ensureButton() {
    if (document.getElementById("sfxToggleBtn")) return;
    const target = document.querySelector(".top-actions");
    if (!target) return;

    const btn = document.createElement("button");
    btn.id = "sfxToggleBtn";
    btn.type = "button";
    btn.className = "btn ghost";
    btn.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      unlockAudio();
      setMuted(!isMuted());
      if (!isMuted()) play("ready");
    };

    target.insertBefore(btn, target.firstChild);
    updateButton();
  }

  function classifyButton(text) {
    if (!text) return "click";
    if (text.includes("준비")) return "ready";
    if (text.includes("게임 시작") || text.includes("다음 라운드")) return "start";
    if (text.includes("선택 카드") || text.includes("반환 카드")) return "play";
    if (text.includes("패스")) return "pass";
    if (text.includes("강퇴") || text.includes("방 나가기") || text.includes("방 삭제") || text.includes("게임 중지")) return "kick";
    if (text.includes("관전") || text.includes("참가")) return "ready";
    if (text.includes("AI 추가") || text.includes("저장")) return "click";
    return "click";
  }

  function bindClickSounds() {
    document.addEventListener("pointerdown", event => {
      unlockAudio();

      const handCard = event.target.closest?.(".hand-stack");
      if (handCard) {
        play("select");
        return;
      }

      const btn = event.target.closest?.("button");
      if (!btn || btn.id === "sfxToggleBtn") return;
      play(classifyButton(btn.textContent.trim()));
    }, true);
  }

  function observeMessages() {
    const observer = new MutationObserver(() => {
      const message = document.getElementById("messageBar")?.textContent?.trim() || "";
      if (message && message !== lastMessageText) {
        lastMessageText = message;
        if (message.includes("상납")) play("tribute");
        else if (message.includes("내 차례")) play("ready");
      }

      const selected = document.getElementById("selectedSummary")?.textContent?.trim() || "";
      if (selected && selected !== lastSelectedText) {
        lastSelectedText = selected;
        if (selected.includes("낼 수") || selected.includes("선택해야")) play("error");
      }

      const chat = document.getElementById("chatList");
      const systemText = Array.from(chat?.querySelectorAll?.(".chat-msg.system") || [])
        .map(el => el.textContent.trim())
        .filter(Boolean)
        .slice(-1)[0] || "";

      if (systemText && systemText !== lastSystemText) {
        lastSystemText = systemText;
        if (systemText.includes("민란")) play("rebellion");
        else if (systemText.includes("상납")) play("tribute");
        else if (systemText.includes("종료")) play("roundEnd");
        else if (systemText.includes("시작")) play("start");
        else if (systemText.includes("강퇴") || systemText.includes("나갔")) play("kick");
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    ensureButton();
    bindClickSounds();
    observeMessages();
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
