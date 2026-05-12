const STACK_TILE_QUEUE_LIMIT=7;
const STACK_TILE_STORAGE_LIMIT=3;

const STACK_TILE_ICONS=[
  "🦁","🐻","🐸","🐢",
  "🍎","🍋","🍇","🍔",
  "⭐","💎","🔥","⚡",
  "🎲","🎯","🎁","🧩",
  "🌙","☀️","🌈","❄️"
];

const STACK_TILE_TIME_LIMITS={
  easy:300,
  normal:420,
  hard:600,
  hell:780
};

const STACK_TILE_DIFFICULTIES={
  easy:{
    label:"쉬움",
    types:8,
    total:48,
    layers:3,
    multiplier:1,
    templates:["smallDiamond","multiPile"],
    selectableMin:10,
    selectableMax:18
  },
  normal:{
    label:"보통",
    types:10,
    total:60,
    layers:4,
    shuffle:3,
    store:3,
    multiplier:1.2,
    templates:["diamond","multiPile","bridge"],
    selectableMin:8,
    selectableMax:15
  },
  hard:{
    label:"어려움",
    types:12,
    total:84,
    layers:6,
    shuffle:3,
    store:3,
    multiplier:1.5,
    templates:["bridge","compactCore","multiPile"],
    selectableMin:6,
    selectableMax:12
  },
  hell:{
    label:"지옥",
    types:14,
    total:105,
    layers:7,
    shuffle:3,
    store:3,
    multiplier:2,
    templates:["compactCore","bridge","diamondCore"],
    selectableMin:5,
    selectableMax:10
  }
};

const STACK_TILE_MATCH_BASE=300;
const STACK_TILE_SHUFFLE_PENALTY=250;
const STACK_TILE_STORE_PENALTY=180;
const STACK_TILE_TIME_BONUS_PER_SEC=5;

function getStackTileShufflePenalty(){
  const used=Number(stackTileState.usedItems.shuffle||0);
  return 250 + used * 150;
}

function getStackTileStorePenalty(){
  const used=Number(stackTileState.usedItems.store||0);
  return 180 + used * 100;
}

const stackTileState={
  difficulty:"normal",
  tiles:[],
  initialTiles:[],
  queue:[],
  history:[],
  startedAt:0,
  endedAt:null,
  pausedAt:null,
  pausedTotalMs:0,
  timerId:null,
  status:"idle",
  message:"",
  moveCount:0,
  matchCount:0,
  maxQueueLength:0,
  score:0,
  matchScore:0,
  itemPenalty:0,
  timeBonus:0,
  scoreFloaters:[],
  usedItems:{
    undo:0,
    shuffle:0,
    store:0
  },
  itemCounts:{
    shuffle:0,
    store:0
  },
  lastFeedbackTileId:"",
  lastAddedTileId:"",
  lastStoredTileIds:[],
  matchingIds:[],
  isAnimating:false,
  clearSaved:false,
  records:[],
  unsubscribeRecords:null
};

function getStackTileConfig(){
  return STACK_TILE_DIFFICULTIES[stackTileState.difficulty]||STACK_TILE_DIFFICULTIES.normal;
}

function getStackTileRecordsRef(){
  return db.collection("events").doc("escape_labyrinth").collection("stackTileRecords");
}

function cloneStackTileTiles(tiles=stackTileState.tiles){
  return tiles.map(tile=>({...tile}));
}

function saveStackTileHistory(){
  stackTileState.history.push({
    tiles:cloneStackTileTiles(),
    queue:[...stackTileState.queue],
    moveCount:stackTileState.moveCount,
    matchCount:stackTileState.matchCount,
    maxQueueLength:stackTileState.maxQueueLength,
    score:stackTileState.score,
    matchScore:stackTileState.matchScore,
    itemPenalty:stackTileState.itemPenalty,
    timeBonus:stackTileState.timeBonus,
    usedItems:{...stackTileState.usedItems},
    itemCounts:{...stackTileState.itemCounts},
    status:stackTileState.status,
    message:stackTileState.message,
    endedAt:stackTileState.endedAt,
    pausedAt:stackTileState.pausedAt,
    pausedTotalMs:stackTileState.pausedTotalMs
  });

  if(stackTileState.history.length>120){
    stackTileState.history.shift();
  }
}

function restoreStackTileSnapshot(snapshot){
  stackTileState.tiles=snapshot.tiles.map(tile=>({...tile}));
  stackTileState.queue=[...snapshot.queue];
  stackTileState.moveCount=snapshot.moveCount;
  stackTileState.matchCount=snapshot.matchCount||0;
  stackTileState.maxQueueLength=snapshot.maxQueueLength;
  stackTileState.score=snapshot.score||0;
  stackTileState.matchScore=snapshot.matchScore||0;
  stackTileState.itemPenalty=snapshot.itemPenalty||0;
  stackTileState.timeBonus=snapshot.timeBonus||0;
  stackTileState.usedItems={...snapshot.usedItems};
  stackTileState.itemCounts={...snapshot.itemCounts};
  stackTileState.status=snapshot.status;
  stackTileState.message=snapshot.message;
  stackTileState.endedAt=snapshot.endedAt;
  stackTileState.pausedAt=snapshot.pausedAt||null;
  stackTileState.pausedTotalMs=snapshot.pausedTotalMs||0;
  stackTileState.lastAddedTileId="";
  stackTileState.lastStoredTileIds=[];
  stackTileState.matchingIds=[];
  stackTileState.isAnimating=false;
  stackTileState.scoreFloaters=[];
}

function shuffleArray(arr){
  const copy=[...arr];

  for(let i=copy.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]]=[copy[j],copy[i]];
  }

  return copy;
}

function randomPick(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

function generateStackTileTypes(config){
  const groups=Math.floor(config.total/3);
  const types=[];

  for(let i=0;i<groups;i++){
    const icon=STACK_TILE_ICONS[i%config.types];
    types.push(icon,icon,icon);
  }

  return shuffleArray(types);
}

function addAnchor(list,x,y,weight=1){
  if(x<0||y<0||x>13||y>9)return;
  list.push({x,y,weight});
}

function buildStackTileAnchors(template){
  const anchors=[];

  if(template==="smallDiamond"){
    const cx=6;
    const cy=4;
    const radius=3;

    for(let dy=-radius;dy<=radius;dy++){
      for(let dx=-radius;dx<=radius;dx++){
        const dist=Math.abs(dx)+Math.abs(dy);
        if(dist>radius)continue;
        addAnchor(anchors,cx+dx*2,cy+dy*2,Math.max(1,radius-dist+1));
      }
    }
  }

  if(template==="diamond"||template==="diamondCore"){
    const cx=6;
    const cy=4;
    const radius=template==="diamondCore"?5:4;

    for(let dy=-radius;dy<=radius;dy++){
      for(let dx=-radius;dx<=radius;dx++){
        const dist=Math.abs(dx)+Math.abs(dy);
        if(dist>radius)continue;

        const step=dist<=2?1:2;
        addAnchor(anchors,cx+dx*step,cy+dy*step,Math.max(1,radius-dist+1));
      }
    }
  }

  if(template==="multiPile"){
    const centers=[
      {x:3,y:3},
      {x:9,y:3},
      {x:6,y:6},
      {x:3,y:8},
      {x:9,y:8}
    ];

    centers.forEach((center,idx)=>{
      const radius=idx===2?3:2;

      for(let dy=-radius;dy<=radius;dy++){
        for(let dx=-radius;dx<=radius;dx++){
          const dist=Math.abs(dx)+Math.abs(dy);
          if(dist>radius)continue;
          addAnchor(anchors,center.x+dx,center.y+dy,Math.max(1,radius-dist+1));
        }
      }
    });
  }

  if(template==="bridge"){
    const left={x:4,y:5};
    const right={x:9,y:5};

    [left,right].forEach(center=>{
      for(let dy=-3;dy<=3;dy++){
        for(let dx=-3;dx<=3;dx++){
          const dist=Math.abs(dx)+Math.abs(dy);
          if(dist>3)continue;
          addAnchor(anchors,center.x+dx,center.y+dy,Math.max(1,4-dist));
        }
      }
    });

    for(let i=0;i<7;i++){
      addAnchor(anchors,3+i,5+(i%2),3);
    }

    for(let i=0;i<5;i++){
      addAnchor(anchors,4+i,7-(i%2),2);
    }
  }

  if(template==="compactCore"){
    const cx=6;
    const cy=5;

    for(let dy=-5;dy<=5;dy++){
      for(let dx=-5;dx<=5;dx++){
        const dist=Math.abs(dx)+Math.abs(dy);
        if(dist>6)continue;

        const dense=dist<=3;
        addAnchor(
          anchors,
          cx+dx,
          cy+dy,
          dense?6-dist:2
        );
      }
    }
  }

  return shuffleArray(anchors);
}

function getStackTileOffsetPattern(){
  const patterns=[
    [
      {dx:0,dy:0},
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:1,dy:1},
      {dx:0,dy:1},
      {dx:0,dy:0},
      {dx:1,dy:1}
    ],
    [
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:0,dy:0},
      {dx:0,dy:1},
      {dx:1,dy:1},
      {dx:0,dy:0},
      {dx:1,dy:0}
    ],
    [
      {dx:0,dy:0},
      {dx:0,dy:1},
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:1,dy:1},
      {dx:0,dy:1},
      {dx:0,dy:0}
    ],
    [
      {dx:0,dy:0},
      {dx:1,dy:1},
      {dx:0,dy:0},
      {dx:1,dy:0},
      {dx:0,dy:1},
      {dx:1,dy:1},
      {dx:0,dy:0}
    ]
  ];

  return randomPick(patterns);
}

function generateStackTileSlotsByTemplate(config,template){
  const anchors=buildStackTileAnchors(template);
  const weighted=[];

  anchors.forEach((anchor,idx)=>{
    const weight=Math.max(1,Number(anchor.weight||1));
    for(let i=0;i<weight;i++){
      weighted.push(idx);
    }
  });

  const heights=new Map();
  let total=0;

  while(total<config.total&&weighted.length){
    const anchorIdx=randomPick(weighted);
    const current=heights.get(anchorIdx)||0;

    if(current>=config.layers)continue;

    heights.set(anchorIdx,current+1);
    total++;
  }

  let safety=0;

  while(total<config.total&&safety<5000){
    safety++;
    const anchorIdx=Math.floor(Math.random()*anchors.length);
    const current=heights.get(anchorIdx)||0;

    if(current>=config.layers)continue;

    heights.set(anchorIdx,current+1);
    total++;
  }

  const slots=[];

  [...heights.entries()].forEach(([anchorIdx,height])=>{
    const anchor=anchors[anchorIdx];
    const pattern=getStackTileOffsetPattern();

    for(let z=0;z<height;z++){
      const offset=pattern[z%pattern.length];

      slots.push({
        x:anchor.x+offset.dx,
        y:anchor.y+offset.dy,
        z
      });
    }
  });

  return shuffleArray(slots).slice(0,config.total);
}

function isStackTileOverlapping(a,b){
  return !(
    a.x+2<=b.x||
    b.x+2<=a.x||
    a.y+2<=b.y||
    b.y+2<=a.y
  );
}

function getStackTileDrawRank(tile){
  return Number(tile.z||0)*10000 + Number(tile.y||0)*100 + Number(tile.x||0);
}

function getStackTileBlockers(tile,tiles){
  if(!tile||tile.removed||tile.area!=="board")return[];

  const tileRank=getStackTileDrawRank(tile);

  return tiles
    .filter(other=>{
      if(!other||other.removed)return false;
      if(other.area!=="board")return false;
      if(other.id===tile.id)return false;
      if(!isStackTileOverlapping(tile,other))return false;
      return getStackTileDrawRank(other)>tileRank;
    })
    .sort((a,b)=>getStackTileDrawRank(a)-getStackTileDrawRank(b));
}

function isStackTileSelectableFromList(tile,tiles){
  if(!tile||tile.removed)return false;
  if(tile.area==="storage")return true;
  if(tile.area!=="board")return false;

  return getStackTileBlockers(tile,tiles).length===0;
}

function isStackTileSelectable(tile){
  return isStackTileSelectableFromList(tile,stackTileState.tiles);
}

function getStackTileFace(tile,tiles=stackTileState.tiles){
  if(tile.area==="storage")return"front";
  if(isStackTileSelectableFromList(tile,tiles))return"front";

  const blockers=getStackTileBlockers(tile,tiles);
  const closest=blockers[0];

  if(closest&&isStackTileSelectableFromList(closest,tiles))return"preview";

  return"back";
}

function countStackTileSelectable(tiles){
  return tiles.filter(tile=>isStackTileSelectableFromList(tile,tiles)).length;
}

function getStackTileSelectableBoardTiles(tiles){
  return tiles.filter(tile=>
    tile &&
    !tile.removed &&
    tile.area==="board" &&
    isStackTileSelectableFromList(tile,tiles)
  );
}

function hasVisibleStackTileTriple(tiles){
  const counts={};

  getStackTileSelectableBoardTiles(tiles).forEach(tile=>{
    counts[tile.type]=(counts[tile.type]||0)+1;
  });

  return Object.values(counts).some(count=>count>=3);
}

function assignStackTileTypesWithVisibleTriple(slots,config,attempt){
  const baseTiles=slots.map((slot,idx)=>({
    id:`stackTile_${Date.now()}_${attempt}_${idx}`,
    type:"",
    x:slot?.x||0,
    y:slot?.y||0,
    z:slot?.z||0,
    area:"board",
    removed:false,
    storageIndex:null
  }));

  const selectable=getStackTileSelectableBoardTiles(baseTiles);

  if(selectable.length<3){
    const fallbackTypes=generateStackTileTypes(config);

    return baseTiles.map((tile,idx)=>({
      ...tile,
      type:fallbackTypes[idx]||STACK_TILE_ICONS[0]
    }));
  }

  const typePool=generateStackTileTypes(config);
  const chosenType=randomPick(typePool);
  const chosenSelectable=shuffleArray(selectable).slice(0,3);
  const chosenIds=new Set(chosenSelectable.map(tile=>tile.id));

  let removed=0;
  const remainingTypes=[];

  typePool.forEach(type=>{
    if(type===chosenType&&removed<3){
      removed++;
      return;
    }

    remainingTypes.push(type);
  });

  const shuffledRemaining=shuffleArray(remainingTypes);

  return baseTiles.map(tile=>{
    if(chosenIds.has(tile.id)){
      return{
        ...tile,
        type:chosenType
      };
    }

    return{
      ...tile,
      type:shuffledRemaining.pop()||STACK_TILE_ICONS[0]
    };
  });
}

function createStackTileTiles(){
  const config=getStackTileConfig();
  let bestTiles=null;
  let bestScore=Infinity;

  for(let attempt=0;attempt<80;attempt++){
    const template=randomPick(config.templates);
    const slots=generateStackTileSlotsByTemplate(config,template);
    const tiles=assignStackTileTypesWithVisibleTriple(slots,config,attempt);

    const selectable=countStackTileSelectable(tiles);
    const inRange=selectable>=config.selectableMin&&selectable<=config.selectableMax;
    const hasTriple=hasVisibleStackTileTriple(tiles);

    const score=
      (inRange?0:Math.min(
        Math.abs(selectable-config.selectableMin),
        Math.abs(selectable-config.selectableMax)
      ))+
      (hasTriple?0:100);

    if(score<bestScore){
      bestScore=score;
      bestTiles=tiles;
    }

    if(inRange&&hasTriple)return tiles;
  }

  return bestTiles||[];
}

function resetStackTileRunWithTiles(tiles,message){
  const config=getStackTileConfig();

  stackTileState.tiles=tiles.map(tile=>({
    ...tile,
    area:"board",
    removed:false,
    storageIndex:null
  }));

  stackTileState.queue=[];
  stackTileState.history=[];
  stackTileState.startedAt=Date.now();
  stackTileState.endedAt=null;
  stackTileState.pausedAt=null;
  stackTileState.pausedTotalMs=0;
  stackTileState.status="playing";
  stackTileState.message=message||"완전히 드러난 타일만 선택할 수 있습니다.";
  stackTileState.moveCount=0;
  stackTileState.matchCount=0;
  stackTileState.maxQueueLength=0;
  stackTileState.score=0;
  stackTileState.matchScore=0;
  stackTileState.itemPenalty=0;
  stackTileState.timeBonus=0;
  stackTileState.scoreFloaters=[];
  stackTileState.usedItems={undo:0,shuffle:0,store:0};
  stackTileState.itemCounts={
    shuffle:Infinity,
    store:Infinity
  };
  stackTileState.lastFeedbackTileId="";
  stackTileState.lastAddedTileId="";
  stackTileState.lastStoredTileIds=[];
  stackTileState.matchingIds=[];
  stackTileState.isAnimating=false;
  stackTileState.clearSaved=false;

  startStackTileTimer();
  subscribeStackTileRecords();
  renderStackTileGame();
}

function restartStackTileGame(){
  const tiles=createStackTileTiles();

  stackTileState.initialTiles=cloneStackTileTiles(tiles);
  resetStackTileRunWithTiles(tiles,"새 게임을 시작했습니다.");
}

window.restartStackTileGame=restartStackTileGame;

function retryStackTileGame(){
  if(!stackTileState.initialTiles.length){
    restartStackTileGame();
    return;
  }

  resetStackTileRunWithTiles(stackTileState.initialTiles,"같은 배치로 다시 시작했습니다.");
}

window.retryStackTileGame=retryStackTileGame;

function setStackTileDifficulty(level){
  if(!STACK_TILE_DIFFICULTIES[level])return;

  stackTileState.difficulty=level;
  restartStackTileGame();
}

window.setStackTileDifficulty=setStackTileDifficulty;

function startStackTileTimer(){
  if(stackTileState.timerId){
    clearInterval(stackTileState.timerId);
    stackTileState.timerId=null;
  }

  stackTileState.timerId=setInterval(()=>{
    if(stackTileState.status==="playing"||stackTileState.status==="paused"){
      updateStackTileStatusTexts();
    }
  },1000);
}

function stopStackTileTimer(){
  if(stackTileState.timerId){
    clearInterval(stackTileState.timerId);
    stackTileState.timerId=null;
  }
}

function pauseStackTileGame(){
  if(stackTileState.status!=="playing")return;
  if(stackTileState.isAnimating)return;

  stackTileState.pausedAt=Date.now();
  stackTileState.status="paused";
  stackTileState.message="일시정지 중입니다.";
  renderStackTileGame();
}

window.pauseStackTileGame=pauseStackTileGame;

function resumeStackTileGame(){
  if(stackTileState.status!=="paused")return;

  if(stackTileState.pausedAt){
    stackTileState.pausedTotalMs+=Date.now()-stackTileState.pausedAt;
  }

  stackTileState.pausedAt=null;
  stackTileState.status="playing";
  stackTileState.message="게임을 다시 시작했습니다.";
  renderStackTileGame();
}

window.resumeStackTileGame=resumeStackTileGame;

function getStackTileElapsedMs(){
  if(!stackTileState.startedAt)return 0;

  const end=stackTileState.endedAt||Date.now();
  const currentPause=stackTileState.status==="paused"&&stackTileState.pausedAt
    ? Date.now()-stackTileState.pausedAt
    : 0;

  return Math.max(0,end-stackTileState.startedAt-stackTileState.pausedTotalMs-currentPause);
}

function formatStackTileTime(ms){
  const sec=Math.floor(ms/1000);
  const m=String(Math.floor(sec/60)).padStart(2,"0");
  const s=String(sec%60).padStart(2,"0");

  return `${m}:${s}`;
}

function addStackTileScore(amount,label){
  const value=Number(amount||0);
  if(!Number.isFinite(value)||value===0)return;

  stackTileState.score=Math.max(0,Math.round((stackTileState.score||0)+value));

  const id=`score_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  stackTileState.scoreFloaters.push({id,amount:value,label:label||""});

  setTimeout(()=>{
    stackTileState.scoreFloaters=stackTileState.scoreFloaters.filter(v=>v.id!==id);
    renderStackTileGame();
  },900);
}

function getStackTileMatchScore(){
  const config=getStackTileConfig();
  return Math.round(STACK_TILE_MATCH_BASE*config.multiplier);
}

function getStackTileTimeBonus(){
  const limit=STACK_TILE_TIME_LIMITS[stackTileState.difficulty]||420;
  const elapsedSec=Math.floor(getStackTileElapsedMs()/1000);

  return Math.max(0,(limit-elapsedSec)*STACK_TILE_TIME_BONUS_PER_SEC);
}

function calculateStackTileScore(){
  return Math.max(0,Math.round((stackTileState.score||0)+(stackTileState.timeBonus||0)));
}

function getStackTileRemainingCount(){
  return stackTileState.tiles.filter(tile=>!tile.removed).length;
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

function getStackTileTripleIds(type){
  return stackTileState.queue.filter(tileId=>{
    const tile=stackTileState.tiles.find(v=>v.id===tileId);
    return tile&&tile.type===type;
  }).slice(0,3);
}

function removeStackTileIds(ids){
  const removeIds=new Set(ids);

  stackTileState.queue=stackTileState.queue.filter(tileId=>!removeIds.has(tileId));

  stackTileState.tiles.forEach(tile=>{
    if(removeIds.has(tile.id)){
      tile.removed=true;
      tile.area="removed";
    }
  });
}

function finishStackTileMove(removedCount){
  const remaining=getStackTileRemainingCount();

  if(remaining===0){
    stackTileState.status="clear";
    stackTileState.endedAt=Date.now();
    stackTileState.timeBonus=getStackTileTimeBonus();

    if(stackTileState.timeBonus>0){
      addStackTileScore(stackTileState.timeBonus,"TIME");
    }

    stackTileState.message=`클리어! 최종 점수 ${calculateStackTileScore().toLocaleString()}점`;
    stopStackTileTimer();
    saveStackTileRecord();
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
  if(stackTileState.isAnimating)return;

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
  tile.storageIndex=null;
  stackTileState.moveCount++;
  stackTileState.lastAddedTileId=tile.id;
  stackTileState.lastStoredTileIds=[];

  insertStackTileIntoQueue(tile);
  stackTileState.maxQueueLength=Math.max(stackTileState.maxQueueLength,stackTileState.queue.length);

  const tripleIds=getStackTileTripleIds(tile.type);

  if(tripleIds.length>=3){
    const matchScore=getStackTileMatchScore();

    stackTileState.matchingIds=tripleIds;
    stackTileState.isAnimating=true;
    stackTileState.matchCount++;
    stackTileState.matchScore+=matchScore;
    addStackTileScore(matchScore,"MATCH");
    stackTileState.message=`같은 타일 3개가 맞춰졌습니다. +${matchScore}`;
    renderStackTileGame();

    setTimeout(()=>{
      removeStackTileIds(tripleIds);
      stackTileState.matchingIds=[];
      stackTileState.isAnimating=false;
      stackTileState.lastAddedTileId="";
      finishStackTileMove(3);
      renderStackTileGame();
    },260);

    return;
  }

  finishStackTileMove(0);
  renderStackTileGame();

  setTimeout(()=>{
    if(stackTileState.lastAddedTileId===tile.id){
      stackTileState.lastAddedTileId="";
      renderStackTileGame();
    }
  },260);
}

window.handleStackTileClick=handleStackTileClick;

function useStackTileUndo(){
  if(stackTileState.status!=="playing")return;
  if(stackTileState.isAnimating)return;
  if(!stackTileState.history.length)return;

  const snapshot=stackTileState.history.pop();

  restoreStackTileSnapshot(snapshot);
  stackTileState.status="playing";
  stackTileState.usedItems.undo=(stackTileState.usedItems.undo||0)+1;
  stackTileState.message="이전 상태로 되돌렸습니다.";

  renderStackTileGame();
}

window.useStackTileUndo=useStackTileUndo;

function getStackTileStorageTiles(){
  return stackTileState.tiles
    .filter(tile=>tile.area==="storage"&&!tile.removed)
    .sort((a,b)=>(a.storageIndex??0)-(b.storageIndex??0));
}

function getStackTileEmptyStorageIndexes(){
  const used=new Set(getStackTileStorageTiles().map(tile=>Number(tile.storageIndex||0)));
  const empty=[];

  for(let i=0;i<STACK_TILE_STORAGE_LIMIT;i++){
    if(!used.has(i))empty.push(i);
  }

  return empty;
}

function useStackTileStore(){
  if(stackTileState.status!=="playing")return;
  if(stackTileState.isAnimating)return;

  const emptyIndexes=getStackTileEmptyStorageIndexes();

  if(!emptyIndexes.length){
    stackTileState.message="보관 슬롯이 가득 찼습니다.";
    renderStackTileGame();
    return;
  }

  const count=Math.min(emptyIndexes.length,stackTileState.queue.length);

  if(count<=0){
    stackTileState.message="보관할 대기열 타일이 없습니다.";
    renderStackTileGame();
    return;
  }

  saveStackTileHistory();

  const targets=stackTileState.queue.slice(0,count);
  stackTileState.queue=stackTileState.queue.slice(count);

  targets.forEach((tileId,idx)=>{
    const tile=stackTileState.tiles.find(v=>v.id===tileId);
    if(!tile)return;

    tile.area="storage";
    tile.storageIndex=emptyIndexes[idx];
  });

  stackTileState.lastStoredTileIds=[...targets];
const penalty=getStackTileStorePenalty();

stackTileState.usedItems.store++;
stackTileState.itemPenalty+=penalty;
addStackTileScore(-penalty,"STORE");
stackTileState.message=`대기열 앞 ${count}개를 보관했습니다. -${penalty}`;

  renderStackTileGame();

  setTimeout(()=>{
    stackTileState.lastStoredTileIds=[];
    renderStackTileGame();
  },300);
}

window.useStackTileStore=useStackTileStore;

function ensureStackTileVisibleTripleAfterShuffle(){
  const boardTiles=stackTileState.tiles.filter(tile=>tile.area==="board"&&!tile.removed);

  if(boardTiles.length<3)return;
  if(hasVisibleStackTileTriple(stackTileState.tiles))return;

  const selectable=getStackTileSelectableBoardTiles(stackTileState.tiles);

  if(selectable.length<3)return;

  const typeMap={};

  boardTiles.forEach(tile=>{
    typeMap[tile.type]=typeMap[tile.type]||[];
    typeMap[tile.type].push(tile);
  });

  const candidateTypes=Object.keys(typeMap).filter(type=>typeMap[type].length>=3);

  if(!candidateTypes.length)return;

  const chosenType=randomPick(candidateTypes);
  const chosenTiles=shuffleArray(typeMap[chosenType]).slice(0,3);
  const targetTiles=shuffleArray(selectable).slice(0,3);

  chosenTiles.forEach((chosenTile,idx)=>{
    const targetTile=targetTiles[idx];

    if(!chosenTile||!targetTile)return;
    if(chosenTile.id===targetTile.id)return;

    const oldPos={
      x:chosenTile.x,
      y:chosenTile.y,
      z:chosenTile.z
    };

    chosenTile.x=targetTile.x;
    chosenTile.y=targetTile.y;
    chosenTile.z=targetTile.z;

    targetTile.x=oldPos.x;
    targetTile.y=oldPos.y;
    targetTile.z=oldPos.z;
  });
}

function useStackTileShuffle(){
  if(stackTileState.status!=="playing")return;
  if(stackTileState.isAnimating)return;

  const boardTiles=stackTileState.tiles.filter(tile=>tile.area==="board"&&!tile.removed);

  if(boardTiles.length<3)return;

  saveStackTileHistory();

  const boardPositions=shuffleArray(boardTiles.map(tile=>({
    x:tile.x,
    y:tile.y,
    z:tile.z
  })));

  boardTiles.forEach((tile,idx)=>{
    tile.x=boardPositions[idx].x;
    tile.y=boardPositions[idx].y;
    tile.z=boardPositions[idx].z;
  });

  ensureStackTileVisibleTripleAfterShuffle();

const penalty=getStackTileShufflePenalty();

stackTileState.usedItems.shuffle++;
stackTileState.itemPenalty+=penalty;
addStackTileScore(-penalty,"SHUFFLE");
stackTileState.message=`보드에 남은 타일을 재배치했습니다. 바로 맞출 수 있는 3개가 보입니다. -${penalty}`;

  renderStackTileGame();
}

window.useStackTileShuffle=useStackTileShuffle;

function subscribeStackTileRecords(){
  if(stackTileState.unsubscribeRecords){
    stackTileState.unsubscribeRecords();
    stackTileState.unsubscribeRecords=null;
  }

  try{
    stackTileState.unsubscribeRecords=getStackTileRecordsRef()
      .where("difficulty","==",stackTileState.difficulty)
      .limit(100)
      .onSnapshot(snap=>{
        stackTileState.records=snap.docs.map(doc=>({id:doc.id,...(doc.data()||{})}))
          .sort((a,b)=>{
            const scoreDiff=Number(b.score||0)-Number(a.score||0);
            if(scoreDiff!==0)return scoreDiff;
            const timeDiff=Number(a.clearTimeMs||999999999)-Number(b.clearTimeMs||999999999);
            if(timeDiff!==0)return timeDiff;
            return Number(a.moveCount||999999)-Number(b.moveCount||999999);
          })
          .slice(0,20);

        renderStackTileGame();
      },err=>{
        console.error("겹겹타일 랭킹 구독 실패",err);
      });
  }catch(err){
    console.error("겹겹타일 랭킹 구독 실패",err);
  }
}

async function saveStackTileRecord(){
  if(stackTileState.clearSaved)return;
  if(!state.currentUser)return;

  stackTileState.clearSaved=true;

  const finalScore=calculateStackTileScore();
  const clearTimeMs=getStackTileElapsedMs();
  const docId=`${stackTileState.difficulty}_${state.currentUser}`;
  const ref=getStackTileRecordsRef().doc(docId);

  const payload={
    nickname:state.currentUser,
    difficulty:stackTileState.difficulty,
    difficultyLabel:getStackTileConfig().label,
    score:finalScore,
    clearTimeMs,
    clearTimeText:formatStackTileTime(clearTimeMs),
    moveCount:stackTileState.moveCount,
    matchCount:stackTileState.matchCount,
    matchScore:stackTileState.matchScore,
    itemPenalty:stackTileState.itemPenalty,
    timeBonus:stackTileState.timeBonus,
    usedItems:{...stackTileState.usedItems},
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  };

  try{
    const snap=await ref.get();
    const prev=snap.exists?(snap.data()||{}):null;
    const shouldSave=!prev||
      finalScore>Number(prev.score||0)||
      (finalScore===Number(prev.score||0)&&clearTimeMs<Number(prev.clearTimeMs||999999999));

    if(shouldSave){
      await ref.set(payload,{merge:true});
      stackTileState.message="신기록이 저장되었습니다.";
    }else{
      stackTileState.message="클리어! 기존 기록이 더 높습니다.";
    }

    renderStackTileGame();
  }catch(err){
    console.error("겹겹타일 기록 저장 실패",err);
  }
}

function renderStackTileStats(){
  const config=getStackTileConfig();
  const elapsed=formatStackTileTime(getStackTileElapsedMs());
  const remaining=getStackTileRemainingCount();
  const finalScore=calculateStackTileScore();

  return`
    <div class="stack-tile-statusbar">
      <div class="stack-tile-status-main">
        <span class="stack-tile-status-difficulty">${escapeHtml(config.label)}</span>
        <span>타일 <b id="stackTileRemainingText">${remaining}</b></span>
        <span id="stackTileElapsedText">${elapsed}</span>
        <span class="stack-tile-score-stat">
          <b id="stackTileScoreText">${finalScore.toLocaleString()}</b>점${renderStackTileScoreFloaters()}
        </span>
      </div>
    </div>
  `;
}

function updateStackTileStatusTexts(){
  const elapsedEl=document.getElementById("stackTileElapsedText");
  const remainingEl=document.getElementById("stackTileRemainingText");
  const scoreEl=document.getElementById("stackTileScoreText");

  if(elapsedEl){
    elapsedEl.textContent=formatStackTileTime(getStackTileElapsedMs());
  }

  if(remainingEl){
    remainingEl.textContent=String(getStackTileRemainingCount());
  }

  if(scoreEl){
    scoreEl.textContent=calculateStackTileScore().toLocaleString();
  }
}

function renderStackTileScoreFloaters(){
  if(!stackTileState.scoreFloaters.length)return"";

  return`
    <span class="stack-tile-score-float-wrap">
      ${stackTileState.scoreFloaters.map(item=>`
        <span class="stack-tile-score-floater ${item.amount>0?"plus":"minus"}">
          ${item.amount>0?"+":""}${Number(item.amount).toLocaleString()}
        </span>
      `).join("")}
    </span>
  `;
}

function renderStackTileDifficultyButtons(){
  return`
    <div class="stack-tile-difficulty-select-wrap">
      <label for="stackTileDifficultySelect">난이도</label>
      <select id="stackTileDifficultySelect" class="stack-tile-difficulty-select" onchange="setStackTileDifficulty(this.value)">
        ${Object.entries(STACK_TILE_DIFFICULTIES).map(([key,cfg])=>`
          <option value="${key}" ${stackTileState.difficulty===key?"selected":""}>${cfg.label}</option>
        `).join("")}
      </select>
    </div>
  `;
}


function getStackTilePreviewIds(boardTiles){
  const ids=new Set();

  boardTiles.forEach(tile=>{
    if(!tile||tile.removed||tile.area!=="board")return;
    if(isStackTileSelectableFromList(tile,boardTiles))return;

    const blockers=getStackTileBlockers(tile,boardTiles);

    if(!blockers.length)return;

    const canOpenSoon=blockers.every(blocker=>
      isStackTileSelectableFromList(blocker,boardTiles)
    );

    if(canOpenSoon){
      ids.add(tile.id);
    }
  });

  return ids;
}

function renderStackTileStorageOnBoard(){
  const storageTiles=stackTileState.tiles
    .filter(tile=>tile.area==="storage"&&!tile.removed)
    .sort((a,b)=>(a.storageIndex||0)-(b.storageIndex||0));

  const slots=[];

  for(let i=0;i<3;i++){
    const tile=storageTiles.find(v=>Number(v.storageIndex)===i);

    if(tile){
      const pop=stackTileState.lastStoredTileIds.includes(tile.id)?"stored-pop":"";

      slots.push(`
        <button type="button" class="stack-tile-storage-tile ${pop}" onclick="handleStackTileClick('${tile.id}')">
          ${tile.type}
        </button>
      `);
    }else{
      slots.push(`<div class="stack-tile-slot"></div>`);
    }
  }

  return`
    <div class="stack-tile-storage-on-board">
      ${slots.join("")}
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

  const visiblePreviewIds=getStackTilePreviewIds(boardTiles);

  return`
    <div class="stack-tile-board-card">
      <div class="stack-tile-board">
        ${boardTiles.map((tile,idx)=>{
          const selectable=isStackTileSelectable(tile);
          const isPreview=visiblePreviewIds.has(tile.id);
          const feedback=stackTileState.lastFeedbackTileId===tile.id?"blocked-feedback":"";

          let faceClass="back";
          let label="가려진 타일";

          if(selectable){
            faceClass="selectable";
            label="선택 가능";
          }else if(isPreview){
            faceClass="preview";
            label="곧 열릴 수 있는 타일";
          }

          const zIndex=10+tile.z*120+idx;

          return`
            <button
              type="button"
              class="stack-tile ${faceClass} ${feedback}"
              style="--x:${tile.x};--y:${tile.y};z-index:${zIndex};"
              onclick="handleStackTileClick('${tile.id}')"
              title="${label}"
            ><span>${tile.type}</span></button>
          `;
        }).join("")}

        ${renderStackTileStorageOnBoard()}
      </div>
    </div>
  `;
}

function renderStackTileQueue(){
  const tiles=stackTileState.queue.map(tileId=>stackTileState.tiles.find(v=>v.id===tileId)).filter(Boolean);
  const slots=[];

  for(let i=0;i<STACK_TILE_QUEUE_LIMIT;i++){
    const tile=tiles[i];

    if(tile){
      const matching=stackTileState.matchingIds.includes(tile.id)?"matching":"";
      const added=stackTileState.lastAddedTileId===tile.id?"added-pop":"";

      slots.push(`<div class="stack-tile-queue-tile ${matching} ${added}">${tile.type}</div>`);
    }else{
      slots.push(`<div class="stack-tile-slot">${i+1}</div>`);
    }
  }

  return`
    <div class="stack-tile-lane-card stack-tile-queue-card">
      <div class="stack-tile-lane-title">대기열 ${STACK_TILE_QUEUE_LIMIT}칸</div>
      <div class="stack-tile-queue">${slots.join("")}</div>
    </div>
  `;
}

function renderStackTileItems(){
  const disabled=stackTileState.status!=="playing"||stackTileState.isAnimating;

  return`
    <div class="stack-tile-item-row">
      <button type="button" onclick="useStackTileUndo()" ${!stackTileState.history.length||disabled?"disabled":""}>
        실행취소 ∞
      </button>
<button type="button" onclick="useStackTileShuffle()" ${disabled?"disabled":""}>
  재배치 -${getStackTileShufflePenalty()}
</button>
<button type="button" onclick="useStackTileStore()" ${disabled?"disabled":""}>
  보관 -${getStackTileStorePenalty()}
</button>
      <button type="button" onclick="pauseStackTileGame()" ${disabled?"disabled":""}>
        일시정지
      </button>
      <button type="button" onclick="retryStackTileGame()">
        다시하기
      </button>
      <button type="button" onclick="restartStackTileGame()">
        새 게임
      </button>
    </div>
  `;
}

function renderStackTileRankings(){
  const config=getStackTileConfig();
  const rows=stackTileState.records||[];

  return`
    <aside class="stack-tile-ranking-card">
      <div class="stack-tile-ranking-title">${config.label} 랭킹</div>
      <div class="stack-tile-ranking-list">
        ${rows.length?rows.slice(0,10).map((row,idx)=>`
          <div class="stack-tile-rank-row ${row.nickname===state.currentUser?"me":""}">
            <span class="stack-tile-rank-no">${idx+1}</span>
            <span class="stack-tile-rank-name">${escapeHtml(row.nickname||"-")}</span>
            <span class="stack-tile-rank-score">${Number(row.score||0).toLocaleString()}</span>
            <span class="stack-tile-rank-time">${escapeHtml(row.clearTimeText||formatStackTileTime(Number(row.clearTimeMs||0)))}</span>
          </div>
        `).join(""):`<div class="stack-tile-rank-empty">아직 기록이 없습니다.</div>`}
      </div>
    </aside>
  `;
}

function renderStackTileFailOverlay(){
  if(stackTileState.status!=="fail")return"";

  return`
    <div class="stack-tile-result-overlay">
      <div class="stack-tile-result-box">
        <div class="stack-tile-result-title">실패!</div>
        <div class="stack-tile-result-desc">
          대기열이 가득 찼습니다.<br>
          같은 배치로 다시 도전하거나 새 게임을 시작할 수 있습니다.
        </div>
        <div class="stack-tile-result-meta">
          시간 ${escapeHtml(formatStackTileTime(getStackTileElapsedMs()))}
          · 이동 ${stackTileState.moveCount}
          · 점수 ${calculateStackTileScore().toLocaleString()}
        </div>
        <div class="stack-tile-result-actions">
          <button type="button" onclick="retryStackTileGame()">다시하기</button>
          <button type="button" onclick="restartStackTileGame()">새 게임</button>
        </div>
      </div>
    </div>
  `;
}

function renderStackTilePauseOverlay(){
  if(stackTileState.status!=="paused")return"";

  return`
    <div class="stack-tile-result-overlay">
      <div class="stack-tile-result-box">
        <div class="stack-tile-result-title pause">일시정지</div>
        <div class="stack-tile-result-desc">게임이 멈춰 있습니다.</div>
        <div class="stack-tile-result-meta">현재 시간 ${escapeHtml(formatStackTileTime(getStackTileElapsedMs()))}</div>
        <div class="stack-tile-result-actions three">
          <button type="button" onclick="resumeStackTileGame()">계속하기</button>
          <button type="button" onclick="retryStackTileGame()">다시하기</button>
          <button type="button" onclick="restartStackTileGame()">새 게임</button>
        </div>
      </div>
    </div>
  `;
}

function renderStackTileClearOverlay(){
  if(stackTileState.status!=="clear")return"";

  return`
    <div class="stack-tile-result-overlay">
      <div class="stack-tile-result-box">
        <div class="stack-tile-result-title clear">클리어!</div>
        <div class="stack-tile-score-detail">
          <div><span>타일 점수</span><strong>${Number(stackTileState.matchScore||0).toLocaleString()}</strong></div>
          <div><span>시간 보너스</span><strong>${Number(stackTileState.timeBonus||0).toLocaleString()}</strong></div>
          <div><span>아이템 감점</span><strong>-${Number(stackTileState.itemPenalty||0).toLocaleString()}</strong></div>
          <div class="total"><span>최종 점수</span><strong>${calculateStackTileScore().toLocaleString()}</strong></div>
        </div>
        <div class="stack-tile-result-meta">
          시간 ${escapeHtml(formatStackTileTime(getStackTileElapsedMs()))}
          · 이동 ${stackTileState.moveCount}
        </div>
        <div class="stack-tile-result-actions">
          <button type="button" onclick="retryStackTileGame()">다시하기</button>
          <button type="button" onclick="restartStackTileGame()">새 게임</button>
        </div>
      </div>
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
    <div class="stack-tile-layout">
      <div class="stack-tile-game-card">
        <div class="stack-tile-wrap">
          <div class="stack-tile-top">
            ${renderStackTileStats()}
            ${renderStackTileDifficultyButtons()}
          </div>

          ${renderStackTileBoard()}

          <div class="stack-tile-bottom">
            ${renderStackTileQueue()}
            ${renderStackTileItems()}
            <div class="stack-tile-message ${msgClass}">
              ${escapeHtml(stackTileState.message||"")}
            </div>
          </div>
        </div>
      </div>
      ${renderStackTileRankings()}
    </div>
    ${renderStackTileFailOverlay()}
    ${renderStackTilePauseOverlay()}
    ${renderStackTileClearOverlay()}
  `;
}

function renderStackTileScreen(){
  const panel=document.getElementById("stackTilePanel");
  if(!panel)return;

  if(stackTileState.status==="idle"){
    restartStackTileGame();
    return;
  }

  subscribeStackTileRecords();
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
