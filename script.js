let users=[]

function apply(){

let name=document.getElementById("name").value

users.push(name)

render()

}

function render(){

let list=document.getElementById("list")

list.innerHTML=""

users.forEach(u=>{

let li=document.createElement("li")
li.innerText=u

list.appendChild(li)

})

}
