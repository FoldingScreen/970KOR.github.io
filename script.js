body{
font-family:sans-serif;
margin:20px;
background:#f4f4f4;
}

/* 상단 */

.topbar{
position:absolute;
top:10px;
right:20px;
display:flex;
gap:10px;
}

/* 카드 그리드 */

.relicGrid{

display:grid;

grid-template-columns:repeat(4,1fr);

gap:16px;

margin-top:20px;

}

/* 카드 */

.relicCard{

background:#eef3ff;

padding:14px;

border-radius:10px;

box-shadow:0 3px 8px rgba(0,0,0,0.15);

min-height:220px;

display:flex;

flex-direction:column;

gap:6px;

}

/* 텍스트 */

.relicTitle{
font-weight:700;
}

.relicTime{
font-size:14px;
}

.relicPower{
font-size:14px;
margin-bottom:6px;
}

/* 멤버 */

.member{
font-size:14px;
}

.me{
color:#1a73e8;
font-weight:700;
}

/* 모바일 */

@media (max-width:768px){

.relicGrid{
grid-template-columns:1fr;
}

}
