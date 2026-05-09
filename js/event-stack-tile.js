const STACK_TILE_QUEUE_LIMIT=7;

const STACK_TILE_ICONS=[
  "🦁","🐻","🐺","🦊","🐯","🐼","🐸","🐵",
  "🐰","🐨","🐹","🐧","🦉","🐢","🦄","🐲"
];

const STACK_TILE_DIFFICULTIES={
  easy:{
    label:"쉬움",
    types:8,
    total:48,
    layers:2,
    undo:3,
    shuffle:2,
    store:1,
    multiplier:1
  },
  normal:{
    label:"보통",
    types:10,
    total:60,
    layers:3,
    undo:2,
    shuffle:1,
    store:1,
    multiplier:1.2
  },
  hard:{
    label:"어려움",
    types:12,
    total:72,
    layers:4,
    undo:1,
    shuffle:1,
    store:1,
    multiplier:1.5
  },
  hell:{
    label:"지옥",
    types:14,
    total:84,
    layers:5,
    undo:1,
    shuffle:0,
    store:1,
    multiplier:2
  }
};

const stackTileState={
  difficulty:"normal",
  tiles:[],
  queue:[],
  history:[],
  startedAt:0,
  endedAt:null,
  timerId:null,
  status:"idle",
  message:"",
  moveCount:0,
  maxQueueLength:0,
  usedItems:{
    undo:0,
    shuffle:0,
    store:0
  },
  itemCounts:{
    undo:0,
    shuffle:0,
    store:0
  },
  lastFeedbackTileId:""
};

function getStackTileConfig(){
  return STACK_TILE_DIFFICULTIES[stackTileState.difficulty]||STACK_TILE_DIFFICULTIES.normal;
}

function cloneStackTileTiles(){
  return stackTileState.tiles.map(tile=>({...tile}));
}

function saveStackTileHistory(){
  stackTileState.history.push({
    tiles:cloneStackTileTiles(),
    queue:[...stackTileState.queue],
    moveCount:stackTileState.moveCount,
    maxQueueLength:stackTileState.maxQueueLength,
    usedItems:{...stackTileState.usedItems},
    itemCounts:{...stackTileState.itemCounts},
    status:stackTileState.status,
    message:stackTileState.message,
    endedAt:stackTileState.endedAt
  });

  if(stackTileState.history.length>30){
    stackTileState.history.shift();
  }
}

function restoreStackTileSnapshot(snapshot){
  stackTileState.tiles=snapshot.tiles.map(tile=>({...tile}));
  stackTileState.queue=[...snapshot.queue];
  stackTileState.moveCount=snapshot.moveCount;
  stackTileState.maxQueueLength=snapshot.maxQueueLength;
  stackTileState.usedItems={...snapshot.usedItems};
  stackTileState.itemCounts={...snapshot.itemCounts};
  stackTileState.status=snapshot.status;
  stackTileState.message=snapshot.message;
  stackTileState.endedAt=snapshot.endedAt;
}

function shuffleArray(arr){
  const copy=[...arr];

  for(let i=copy.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]]=[copy[j],copy[i]];
  }

  return copy;
}

function generateStackTileTypes(config){
  const types=[];

  for(let i=0;i<config.types;i++){
    const icon=STACK_TILE_ICONS[i%STACK_TILE_ICONS.length];
    const repeatCount=config.total/config.types;

    for(let j=0;j<repeatCount;j++){
      types.push(icon);
    }
  }

  return shuffleArray(types);
}

function generateStackTileSlots(config){
  const anchors=[];
  const cols=5;
  const rows=5;

  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      anchors.push({
        x:1+c*3,
        y:1+r*3
      });
    }
  }

  const anchorCount=Math.min(
    anchors.length,
    Math.max(
      Math.ceil(config.total/3),
      Math.ceil(config.total/config.layers)
    )
  );

  const selectedAnchors=shuffleArray(anchors).slice(0,anchorCount);
  const heights=selectedAnchors.map(()=>1);
  let remaining=config.total-anchorCount;

  while(remaining>0){
    const idx=Math.floor(Math.random()*heights.length);
    if(heights[idx]>=config.layers)continue;
    heights[idx]++;
    remaining--;
  }

  const offsetPatterns=[
    [
      {dx:0,dy:0},
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:1,dy:1},
      {dx:0,dy:1}
    ],
    [
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:0,dy:0},
      {dx:0,dy:1},
      {dx:1,dy:1}
    ],
    [
      {dx:0,dy:0},
      {dx:0,dy:1},
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:1,dy:1}
    ],
    [
      {dx:0,dy:0},
      {dx:1,dy:1},
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:0,dy:1}
    ]
  ];

  const slots=[];

  selectedAnchors.forEach((anchor,idx)=>{
    const pattern=offsetPatterns[Math.floor(Math.random()*offsetPatterns.length)];
    const height=heights[idx];

    for(let z=0;z<height;z++){
      const offset=pattern[Math.min(z,pattern.length-1)];

      slots.push({
        x:anchor.x+offset.dx,
        y:anchor.y+offset.dy,
        z
      });
    }
  });

  return shuffleArray(slots);
}

function createStackTileTiles(){
  const config=getStackTileConfig();
  const types=generateStackTileTypes(config);
  const slots=generateStackTileSlots(config);

  return types.map((type,idx)=>({
    id:`stackTile_${Date.now()}_${idx}`,
    type,
    x:slots[idx]?.x||0,
    y:slots[idx]?.y||0,
    z:slots[idx]?.z||0,
    area:"board",
    removed:false
  }));
}

function startStackTileTimer(){
  if(stackTileState.timerId){
    clearInterval(stackTileState.timerId);
    stackTileState.timerId=null;
  }

  stackTileState.timerId=setInterval(()=>{
    if(stackTileState.status==="playing"){
      renderStackTileGame();
    }
  },1000);
}

function stopStackTileTimer(){
  if(stackTileState.timerId){
    clearInterval(stackTileState.timerId);
    stackTileState.timerId=null;
  }
}

function restartStackTileGame(){
  const config=getStackTileConfig();

  stackTileState.tiles=createStackTileTiles();
  stackTileState.queue=[];
  stackTileState.history=[];
  stackTileState.startedAt=Date.now();
  stackTileState.endedAt=null;
  stackTileState.status="playing";
  stackTileState.message="완전히 드러난 타일만 선택할 수 있습니다.";
  stackTileState.moveCount=0;
  stackTileState.maxQueueLength=0;
  stackTileState.usedItems={undo:0,shuffle:0,store:0};
  stackTileState.itemCounts={
    undo:config.undo,
    shuffle:config.shuffle,
    store:config.store
  };
  stackTileState.lastFeedbackTileId="";

  startStackTileTimer();
  renderStackTileGame();
}

window.restartStackTileGame=restartStackTileGame;

function setStackTileDifficulty(level){
  if(!STACK_TILE_DIFFICULTIES[level])return;

  stackTileState.difficulty=level;
  restartStackTileGame();
}

window.setStackTileDifficulty=setStackTileDifficulty;

function isStackTileOverlapping(a,b){
  return !(
    a.x+2<=b.x||
    b.x+2<=a.x||
    a.y+2<=b.y||
    b.y+2<=a.y
  );
}

function isStackTileSelectable(tile){
  if(!tile||tile.removed)return false;

  if(tile.area==="storage")return true;
  if(tile.area!=="board")return false;

  return !stackTileState.tiles.some(other=>{
    if(!other||other.removed)return false;
    if(other.area!=="board")return false;
    if(other.id===tile.id)return false;
    if(other.z<=tile.z)return false;

    return isStackTileOverlapping(tile,other);
  });
}

function getStackTileElapsedMs(){
  if(!stackTileState.startedAt)return 0;

  const end=stackTileState.endedAt||Date.now();
  return Math.max(0,end-stackTileState.startedAt);
}

function formatStackTileTime(ms){
  const sec=Math.floor(ms/1000);
  const m=String(Math.floor(sec/60)).padStart(2,"0");
  const s=String(sec%60).padStart(2,"0");

  return `${m}:${s}`;
}

function calculateStackTileScore(){
  if(stackTileState.status!=="clear")return 0;

  const config=getStackTileConfig();
  const base=10000;
  const elapsedSec=Math.floor(getStackTileElapsedMs()/1000);
  const timePenalty=elapsedSec*10;
  const movePenalty=stackTileState.moveCount*5;
  const itemPenalty=
    stackTileState.usedItems.undo*300+
    stackTileState.usedItems.shuffle*500+
    stackTileState.usedItems.store*400;

  let bonus=0;

  if(
    stackTileState.usedItems.undo===0&&
    stackTileState.usedItems.shuffle===0&&
    stackTileState.usedItems.store===0
  ){
    bonus+=1000;
  }

  if(stackTileState.maxQueueLength<=5)bonus+=700;

  return Math.max(0,Math.floor((base-timePenalty-movePenalty-itemPenalty+bonus)*config.multiplier));
}

function getStackTileRemainingCount(){
  return stackTileState.tiles.filter(tile=>!tile.removed).length;
}

function removeStackTileTriples(type){
  const sameIds=stackTileState.queue.filter(tileId=>{
    const tile=stackTileState.tiles.find(v=>v.id===tileId);
    return tile&&tile.type===type;
  });

  if(sameIds.length<3)return 0;

  const removeIds=new Set(sameIds.slice(0,3));

  stackTileState.queue=stackTileState.queue.filter(tileId=>!removeIds.has(tileId));

  stackTileState.tiles.forEach(tile=>{
    if(removeIds.has(tile.id)){
      tile.removed=true;
      tile.area="removed";
    }
  });

  return removeIds.size;
}

function insertStackTileIntoQueue(tile){
  const sameIndexes=[];

  stackTileState.queue.forEach((tileId,index)=>{
    const qTile=stackTileState.tiles.find(v=>v.id===tileId);

    if(qTile&&qTile.type===tile.type){
      sameIndexes.push(index);
    }
  });

  if(sameIndexes.length){
    const insertIndex=Math.max(...sameIndexes)+1;
    stackTileState.queue.splice(insertIndex,0,tile.id);
  }else{
    stackTileState.queue.push(tile.id);
  }
}

function checkStackTileEnd(removedCount){
  const remaining=getStackTileRemainingCount();

  if(remaining===0){
    stackTileState.status="clear";
    stackTileState.endedAt=Date.now();
    stackTileState.message=`클리어! 점수 ${calculateStackTileScore().toLocaleString()}점`;
    stopStackTileTimer();
    return;
  }

  if(stackTileState.queue.length>=STACK_TILE_QUEUE_LIMIT&&removedCount===0){
    stackTileState.status="fail";
    stackTileState.endedAt=Date.now();
    stackTileState.message="대기열이 가득 찼습니다. 실패!";
    stopStackTileTimer();
    return;
  }

  stackTileState.message=removedCount
    ? "같은 타일 3개가 사라졌습니다."
    : "타일을 대기열에 넣었습니다.";
}

function handleStackTileClick(tileId){
  if(stackTileState.status!=="playing")return;

  const tile=stackTileState.tiles.find(v=>v.id===tileId);

  if(!tile||tile.removed)return;

  if(!isStackTileSelectable(tile)){
    stackTileState.lastFeedbackTileId=tileId;
    renderStackTileGame();

    setTimeout(()=>{
      if(stackTileState.lastFeedbackTileId===tileId){
        stackTileState.lastFeedbackTileId="";
        renderStackTileGame();
      }
    },220);

    return;
  }

  saveStackTileHistory();

  tile.area="queue";
  stackTileState.moveCount++;
  insertStackTileIntoQueue(tile);
  stackTileState.maxQueueLength=Math.max(stackTileState.maxQueueLength,stackTileState.queue.length);

  const removedCount=removeStackTileTriples(tile.type);

  checkStackTileEnd(removedCount);
  renderStackTileGame();
}

window.handleStackTileClick=handleStackTileClick;

function useStackTileUndo(){
  if(stackTileState.status!=="playing")return;
  if(stackTileState.itemCounts.undo<=0)return;
  if(!stackTileState.history.length)return;

  const snapshot=stackTileState.history.pop();

  stackTileState.itemCounts.undo--;
  stackTileState.usedItems.undo++;

  restoreStackTileSnapshot(snapshot);
  stackTileState.status="playing";
  stackTileState.message="이전 상태로 되돌렸습니다.";

  renderStackTileGame();
}

window.useStackTileUndo=useStackTileUndo;

function useStackTileStore(){
  if(stackTileState.status!=="playing")return;
  if(stackTileState.itemCounts.store<=0)return;
  if(stackTileState.queue.length<3){
    stackTileState.message="대기열에 타일이 3개 이상 있어야 합니다.";
    renderStackTileGame();
    return;
  }

  saveStackTileHistory();

  const targets=stackTileState.queue.slice(0,3);
  stackTileState.queue=stackTileState.queue.slice(3);

  targets.forEach((tileId,idx)=>{
    const tile=stackTileState.tiles.find(v=>v.id===tileId);
    if(!tile)return;

    tile.area="storage";
    tile.storageIndex=idx;
  });

  stackTileState.itemCounts.store--;
  stackTileState.usedItems.store++;
  stackTileState.message="대기열 앞 3칸을 보관 영역에 내려놓았습니다.";

  renderStackTileGame();
}

window.useStackTileStore=useStackTileStore;

function useStackTileShuffle(){
  if(stackTileState.status!=="playing")return;
  if(stackTileState.itemCounts.shuffle<=0)return;

  const boardTiles=stackTileState.tiles.filter(tile=>tile.area==="board"&&!tile.removed);

  if(boardTiles.length<2)return;

  saveStackTileHistory();

  const positions=shuffleArray(boardTiles.map(tile=>({
    x:tile.x,
    y:tile.y,
    z:tile.z
  })));

  boardTiles.forEach((tile,idx)=>{
    tile.x=positions[idx].x;
    tile.y=positions[idx].y;
    tile.z=positions[idx].z;
  });

  stackTileState.itemCounts.shuffle--;
  stackTileState.usedItems.shuffle++;
  stackTileState.message="보드에 남은 타일을 재배치했습니다.";

  renderStackTileGame();
}

window.useStackTileShuffle=useStackTileShuffle;

function renderStackTileStats(){
  const config=getStackTileConfig();
  const elapsed=formatStackTileTime(getStackTileElapsedMs());
  const remaining=getStackTileRemainingCount();
  const score=stackTileState.status==="clear"?calculateStackTileScore():0;

  return`
    <div class="stack-tile-stats">
      <span class="stack-tile-stat">난이도 ${config.label}</span>
      <span class="stack-tile-stat">남은 타일 ${remaining}</span>
      <span class="stack-tile-stat">시간 ${elapsed}</span>
      <span class="stack-tile-stat">이동 ${stackTileState.moveCount}</span>
      ${stackTileState.status==="clear"?`<span class="stack-tile-stat">점수 ${score.toLocaleString()}</span>`:""}
    </div>
  `;
}

function renderStackTileDifficultyButtons(){
  return`
    <div class="stack-tile-difficulty-row">
      ${Object.entries(STACK_TILE_DIFFICULTIES).map(([key,cfg])=>`
        <button type="button" class="${stackTileState.difficulty===key?"active":""}" onclick="setStackTileDifficulty('${key}')">
          ${cfg.label}
        </button>
      `).join("")}
    </div>
  `;
}

function renderStackTileBoard(){
  const boardTiles=stackTileState.tiles
    .filter(tile=>tile.area==="board"&&!tile.removed)
    .sort((a,b)=>{
      if(a.z!==b.z)return a.z-b.z;
      return a.y-b.y||a.x-b.x;
    });

  return`
    <div class="stack-tile-board-card">
      <div class="stack-tile-board">
        ${boardTiles.map((tile,idx)=>{
          const selectable=isStackTileSelectable(tile);
          const feedback=stackTileState.lastFeedbackTileId===tile.id?"blocked-feedback":"";
          const cls=selectable?"selectable":"blocked";
          const zIndex=10+tile.z*100+idx;

          return`
            <button
              type="button"
              class="stack-tile ${cls} ${feedback}"
              style="--x:${tile.x};--y:${tile.y};z-index:${zIndex};"
              onclick="handleStackTileClick('${tile.id}')"
              title="${selectable?"선택 가능":"가려져 있어 선택 불가"}"
            >${tile.type}</button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderStackTileQueue(){
  const tiles=stackTileState.queue.map(tileId=>stackTileState.tiles.find(v=>v.id===tileId)).filter(Boolean);
  const slots=[];

  for(let i=0;i<STACK_TILE_QUEUE_LIMIT;i++){
    const tile=tiles[i];

    slots.push(tile
      ? `<div class="stack-tile-queue-tile">${tile.type}</div>`
      : `<div class="stack-tile-slot">${i+1}</div>`
    );
  }

  return`
    <div class="stack-tile-lane-card">
      <div class="stack-tile-lane-title">대기열 ${STACK_TILE_QUEUE_LIMIT}칸</div>
      <div class="stack-tile-queue">${slots.join("")}</div>
    </div>
  `;
}

function renderStackTileStorage(){
  const storageTiles=stackTileState.tiles
    .filter(tile=>tile.area==="storage"&&!tile.removed)
    .sort((a,b)=>(a.storageIndex||0)-(b.storageIndex||0));

  const slots=[];

  for(let i=0;i<3;i++){
    const tile=storageTiles[i];

    slots.push(tile
      ? `<button type="button" class="stack-tile-storage-tile" onclick="handleStackTileClick('${tile.id}')">${tile.type}</button>`
      : `<div class="stack-tile-slot">보관</div>`
    );
  }

  return`
    <div class="stack-tile-lane-card">
      <div class="stack-tile-lane-title">보관 영역</div>
      <div class="stack-tile-storage">${slots.join("")}</div>
    </div>
  `;
}

function renderStackTileItems(){
  return`
    <div class="stack-tile-item-row">
      <button type="button" onclick="useStackTileUndo()" ${stackTileState.itemCounts.undo<=0||!stackTileState.history.length?"disabled":""}>
        실행취소 ${stackTileState.itemCounts.undo}
      </button>
      <button type="button" onclick="useStackTileShuffle()" ${stackTileState.itemCounts.shuffle<=0?"disabled":""}>
        재배치 ${stackTileState.itemCounts.shuffle}
      </button>
      <button type="button" onclick="useStackTileStore()" ${stackTileState.itemCounts.store<=0?"disabled":""}>
        보관 ${stackTileState.itemCounts.store}
      </button>
      <button type="button" onclick="restartStackTileGame()">
        새 게임
      </button>
    </div>
  `;
}

function renderStackTileGame(){
  const root=document.getElementById("stackTileRoot");
  if(!root)return;

  if(stackTileState.status==="idle"){
    restartStackTileGame();
    return;
  }

  const msgClass=stackTileState.status==="clear"
    ? "clear"
    : stackTileState.status==="fail"
      ? "fail"
      : "";

  root.innerHTML=`
    <div class="stack-tile-wrap">
      <div class="stack-tile-top">
        ${renderStackTileStats()}
        ${renderStackTileDifficultyButtons()}
      </div>

      ${renderStackTileBoard()}

      <div class="stack-tile-bottom">
        ${renderStackTileStorage()}
        ${renderStackTileQueue()}
        ${renderStackTileItems()}
        <div class="stack-tile-message ${msgClass}">
          ${escapeHtml(stackTileState.message||"")}
        </div>
      </div>
    </div>
  `;
}

function renderStackTileScreen(){
  const panel=document.getElementById("stackTilePanel");
  if(!panel)return;

  if(stackTileState.status==="idle"){
    restartStackTileGame();
    return;
  }

  renderStackTileGame();
}

window.renderStackTileScreen=renderStackTileScreen;

(function patchStackTileWebgamePanel(){
  const original=window.updateEscapeLabyrinthHomePanels;

  window.updateEscapeLabyrinthHomePanels=function(){
    if(typeof original==="function")original();

    const panel=document.getElementById("stackTilePanel");
    if(!panel)return;

    const isStackTile=state.escapeLabyrinthTab==="stackTile";

    panel.classList.toggle("hidden",!isStackTile);

    if(isStackTile){
      renderStackTileScreen();
    }
  };
})();
