function getDisplayedRearrangeEntries(entries){
  const capacities={1:10,2:14,3:18,4:18,5:Number.MAX_SAFE_INTEGER};

  const explicit={1:[],2:[],3:[],4:[],5:[]};
  const r45Candidates=[];
  const normal=[];

  entries.forEach(entry=>{
    const text=String(entry.note||"").trim();
    const explicitMatch=text.match(/([1-5])\s*열/);
    const explicitCol=explicitMatch?Number(explicitMatch[1]):0;
    const hasR45=/R4|R5/i.test(text);

    if(explicitCol>=1&&explicitCol<=5){
      explicit[explicitCol].push(entry);
    }else if(hasR45){
      r45Candidates.push(entry);
    }else{
      normal.push(entry);
    }
  });

  const result=[];
  const usedUsers=new Set();

  function pushEntry(entry){
    if(usedUsers.has(entry.user))return false;
    result.push(entry);
    usedUsers.add(entry.user);
    return true;
  }

  function fillFromGroup(group, limitObj){
    for(const entry of group){
      if(limitObj.count>=limitObj.limit)break;
      if(pushEntry(entry))limitObj.count++;
    }
  }

  function remainingNormal(){
    return normal.filter(v=>!usedUsers.has(v.user));
  }
  function remainingR45(){
    return r45Candidates.filter(v=>!usedUsers.has(v.user));
  }
  function remainingExplicit(col){
    return explicit[col].filter(v=>!usedUsers.has(v.user));
  }

  // 1열: 명시 1열 우선, 그 다음 일반 인원으로 채움
  {
    const limitObj={count:0,limit:10};
    fillFromGroup(explicit[1],limitObj);
    fillFromGroup(remainingNormal(),limitObj);
    fillFromGroup(remainingR45(),limitObj);
    fillFromGroup(remainingExplicit(2),limitObj);
    fillFromGroup(remainingExplicit(3),limitObj);
    fillFromGroup(remainingExplicit(4),limitObj);
    fillFromGroup(remainingExplicit(5),limitObj);
  }

  // 방금 1열에 못 들어간 R4/R5만 이제 최소 2열 대상이 됨
  const deferredR45=remainingR45();

  function fillColumn(col, preferredGroups){
    const limit=capacities[col];
    let count=0;

    for(const group of preferredGroups){
      for(const entry of group){
        if(count>=limit)break;
        if(pushEntry(entry))count++;
      }
      if(count>=limit)break;
    }
  }

  fillColumn(2,[remainingExplicit(2), deferredR45, remainingNormal(), remainingExplicit(3), remainingExplicit(4), remainingExplicit(5)]);
  fillColumn(3,[remainingExplicit(3), remainingNormal(), remainingExplicit(2), remainingExplicit(4), remainingExplicit(5)]);
  fillColumn(4,[remainingExplicit(4), remainingNormal(), remainingExplicit(2), remainingExplicit(3), remainingExplicit(5)]);
  fillColumn(5,[remainingExplicit(5), remainingNormal(), remainingExplicit(2), remainingExplicit(3), remainingExplicit(4)]);

  // 남은 사람 마저 뒤에
  for(const group of [remainingNormal(), remainingExplicit(1), remainingExplicit(2), remainingExplicit(3), remainingExplicit(4), remainingExplicit(5), remainingR45()]){
    for(const entry of group){
      pushEntry(entry);
    }
  }

  return result;
}
