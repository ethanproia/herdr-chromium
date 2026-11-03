// Plain data: common emoji by category, each [emoji, "search keywords"]. No gpui imports.
export const categories = [
  { name: "People", items: [
    ["😀","grin smile happy"],["😃","smile happy"],["😄","laugh happy"],["😁","beam grin"],["😆","laugh squint"],["😅","sweat smile"],["🤣","rofl laugh"],["😂","joy tears laugh"],
    ["🙂","slight smile"],["😉","wink"],["😊","blush smile"],["😇","angel halo"],["🥰","love hearts face"],["😍","heart eyes love"],["🤩","star struck wow"],["😘","kiss"],
    ["😋","yum tasty"],["😛","tongue"],["😜","wink tongue crazy"],["🤪","zany crazy"],["🤗","hug"],["🤔","think thinking hmm"],["🤨","skeptical eyebrow"],["😐","neutral"],
    ["😏","smirk"],["😴","sleep zzz"],["😎","cool sunglasses"],["🤓","nerd glasses"],["🧐","monocle curious"],["😕","confused"],["😮","surprised wow"],["😢","cry sad"],
    ["😭","sob cry"],["😡","angry mad"],["🤯","mind blown explode"],["😱","scream fear"],["🥳","party celebrate"],["🥺","pleading"],["🤖","robot bot"],["👻","ghost"],
    ["💀","skull dead"],["👽","alien"],["👍","thumbs up yes like"],["👎","thumbs down no"],["👏","clap applause"],["🙌","raised hands celebrate"],["🙏","pray thanks please"],["💪","muscle strong"],
    ["👋","wave hello hi"],["✌️","peace victory"],["🤞","fingers crossed luck"],["👀","eyes look"],["🧠","brain mind"],["👤","person user"],["👥","people users team"],["🧑‍💻","developer coder"],
  ]},
  { name: "Nature", items: [
    ["🐶","dog puppy"],["🐱","cat kitten"],["🐭","mouse"],["🐰","rabbit bunny"],["🦊","fox"],["🐻","bear"],["🐼","panda"],["🐨","koala"],
    ["🐯","tiger"],["🦁","lion"],["🐮","cow"],["🐷","pig"],["🐸","frog"],["🐵","monkey"],["🐔","chicken"],["🐧","penguin"],
    ["🐦","bird"],["🦉","owl"],["🦄","unicorn"],["🐝","bee honey"],["🦋","butterfly"],["🐢","turtle"],["🐙","octopus"],["🐬","dolphin"],
    ["🐳","whale"],["🦈","shark"],["🐘","elephant"],["🦒","giraffe"],["🌱","seedling sprout plant"],["🌲","tree evergreen"],["🌳","tree"],["🌴","palm tree"],
    ["🌵","cactus"],["🍀","clover luck"],["🍁","maple leaf autumn"],["🌸","blossom flower cherry"],["🌹","rose flower"],["🌻","sunflower"],["🌷","tulip flower"],["🍄","mushroom"],
    ["🌍","earth globe world"],["🌙","moon night"],["⭐","star"],["🌟","glowing star sparkle"],["☀️","sun sunny"],["⛅","cloud sun"],["🌈","rainbow"],["⚡","bolt lightning"],
    ["🔥","fire hot flame"],["💧","drop water"],["🌊","wave ocean sea"],["❄️","snow snowflake cold"],["☁️","cloud"],["🌧️","rain"],["🌪️","tornado"],["🪐","planet saturn"],
  ]},
  { name: "Food", items: [
    ["🍎","apple red"],["🍐","pear"],["🍊","orange tangerine"],["🍋","lemon"],["🍌","banana"],["🍉","watermelon"],["🍇","grapes"],["🍓","strawberry"],
    ["🍒","cherries"],["🍑","peach"],["🥭","mango"],["🍍","pineapple"],["🥑","avocado"],["🍅","tomato"],["🥕","carrot"],["🌽","corn"],
    ["🥦","broccoli"],["🍞","bread"],["🥐","croissant"],["🧀","cheese"],["🥚","egg"],["🥓","bacon"],["🍔","burger hamburger"],["🍟","fries"],
    ["🍕","pizza"],["🌭","hot dog"],["🌮","taco"],["🌯","burrito"],["🍣","sushi"],["🍜","ramen noodles"],["🍝","pasta spaghetti"],["🍰","cake"],
    ["🎂","birthday cake"],["🍩","donut"],["🍪","cookie"],["🍫","chocolate"],["🍿","popcorn"],["☕","coffee tea hot drink"],["🍵","tea matcha"],["🍺","beer"],
    ["🍷","wine"],["🍸","cocktail"],["🥂","cheers champagne"],["🧃","juice"],["🥤","soda cup"],["🧊","ice"],["🍯","honey"],["🥗","salad"],
  ]},
  { name: "Activity", items: [
    ["⚽","soccer football"],["🏀","basketball"],["🏈","american football"],["⚾","baseball"],["🎾","tennis"],["🏐","volleyball"],["🏉","rugby"],["🎱","billiards pool"],
    ["🏓","ping pong"],["🏸","badminton"],["🥊","boxing"],["🥋","martial arts"],["⛳","golf"],["🏹","archery"],["🎣","fishing"],["🏂","snowboard"],
    ["🏄","surf"],["🚴","cycling bike"],["🏆","trophy win"],["🥇","gold medal first"],["🥈","silver medal"],["🥉","bronze medal"],["🏅","medal"],["🎯","target dart goal"],
    ["🎮","game controller video"],["🕹️","joystick"],["🎲","dice game"],["🧩","puzzle piece"],["♟️","chess"],["🎨","art palette paint"],["🎭","theater drama"],["🎬","movie clapper film"],
    ["🎤","microphone sing"],["🎧","headphones music"],["🎼","score music"],["🎹","piano keyboard"],["🥁","drum"],["🎸","guitar"],["🎷","saxophone"],["🎺","trumpet"],
    ["🎉","party tada celebrate"],["🎊","confetti"],["🎈","balloon"],["🎁","gift present"],["🎃","pumpkin halloween"],["🎄","christmas tree"],["🧘","yoga meditate"],["🏋️","weights gym lift"],
  ]},
  { name: "Travel", items: [
    ["🚗","car"],["🚕","taxi"],["🚌","bus"],["🚎","trolley"],["🏎️","race car"],["🚓","police car"],["🚑","ambulance"],["🚒","fire truck"],
    ["🚚","truck delivery"],["🚜","tractor"],["🚲","bicycle bike"],["🛵","scooter"],["🏍️","motorcycle"],["🚂","train"],["🚇","metro subway"],["🚀","rocket launch ship"],
    ["✈️","airplane flight plane"],["🛫","takeoff departure"],["🚁","helicopter"],["⛵","sailboat"],["🚢","ship boat"],["⚓","anchor"],["🗺️","map world"],["🧭","compass"],
    ["🏠","house home"],["🏡","house garden"],["🏢","office building"],["🏭","factory"],["🏥","hospital"],["🏦","bank"],["🏫","school"],["🏰","castle"],
    ["🗽","statue liberty new york"],["🗼","tower tokyo"],["⛰️","mountain"],["🏔️","snow mountain"],["🏝️","island beach"],["🏕️","camping tent"],["🌅","sunrise"],["🌃","night city"],
    ["🌉","bridge night"],["🎡","ferris wheel"],["🎢","roller coaster"],["⛲","fountain"],["🛣️","road highway"],["🚦","traffic light"],["📍","pin location place"],["🧳","luggage travel"],
  ]},
  { name: "Objects", items: [
    ["💡","light bulb idea"],["🔦","flashlight"],["📱","phone mobile"],["💻","laptop computer"],["🖥️","desktop computer"],["⌨️","keyboard"],["🖱️","mouse computer"],["💾","floppy save disk"],
    ["📷","camera photo"],["📹","video camera"],["📺","tv television"],["📻","radio"],["⏰","alarm clock"],["⏳","hourglass time"],["⌛","hourglass"],["🔋","battery"],
    ["🔌","plug power"],["🔧","wrench tool"],["🔨","hammer build"],["🛠️","tools build"],["⚙️","gear settings"],["🧰","toolbox"],["🔬","microscope science"],["🔭","telescope"],
    ["💊","pill medicine"],["🩺","stethoscope"],["🔑","key"],["🔒","lock secure"],["🔓","unlock"],["🛡️","shield security"],["💰","money bag"],["💳","credit card"],
    ["💵","dollar cash money"],["📈","chart up growth"],["📉","chart down"],["📊","bar chart stats"],["📋","clipboard"],["📌","pushpin pin"],["📎","paperclip attach"],["✂️","scissors cut"],
    ["📁","folder"],["📂","open folder"],["🗂️","dividers index"],["🗃️","card file box"],["🗑️","trash delete bin"],["📝","memo note write"],["📓","notebook"],["📔","notebook decorated"],
    ["📚","books library"],["📖","open book read"],["📰","newspaper news"],["🔖","bookmark"],["🏷️","label tag"],["✏️","pencil"],["🖊️","pen"],["🖌️","paintbrush"],
    ["📧","email mail"],["📮","postbox mailbox"],["📦","package box"],["🔍","search magnifier"],["📣","megaphone announce"],["🔔","bell notification"],["🕯️","candle"],["🪄","magic wand"],
    ["📅","calendar date"],["🗓️","calendar spiral"],["🧾","receipt"],["🧪","test tube experiment"],["🪴","potted plant"],["🛒","cart shopping"],["🧸","teddy bear toy"],["🎓","graduation cap"],
  ]},
  { name: "Symbols", items: [
    ["❤️","red heart love"],["🧡","orange heart"],["💛","yellow heart"],["💚","green heart"],["💙","blue heart"],["💜","purple heart"],["🖤","black heart"],["🤍","white heart"],
    ["💔","broken heart"],["💯","hundred perfect"],["✅","check done complete"],["✔️","check mark"],["❌","cross no x"],["❎","cross button"],["❓","question"],["❗","exclamation important"],
    ["⚠️","warning caution"],["🚫","prohibited no"],["⛔","stop no entry"],["🔴","red circle"],["🟠","orange circle"],["🟡","yellow circle"],["🟢","green circle"],["🔵","blue circle"],
    ["🟣","purple circle"],["⚫","black circle"],["⚪","white circle"],["🟥","red square"],["🟩","green square"],["🟦","blue square"],["⬛","black square"],["🔶","orange diamond"],
    ["▶️","play"],["⏸️","pause"],["⏹️","stop"],["🔁","repeat loop"],["🔀","shuffle"],["⬆️","up arrow"],["⬇️","down arrow"],["⬅️","left arrow"],
    ["➡️","right arrow"],["↩️","return back"],["🔄","refresh sync"],["➕","plus add"],["➖","minus"],["✨","sparkles magic new"],["💬","speech chat comment"],["💭","thought bubble"],
    ["🔗","link chain"],["♻️","recycle"],["🏁","finish flag race"],["🚩","red flag"],["🏳️","white flag"],["🆕","new"],["🆗","ok"],["🔝","top"],
  ]},
];

// Emoji whose keywords (or the emoji itself) contain every word of the query, in category order.
export function search(query) {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out = [];
  for (const c of categories) for (const [e, kw] of c.items) {
    if (words.every((w) => kw.includes(w) || e === w)) out.push(e);
  }
  return out;
}
