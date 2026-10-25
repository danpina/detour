/**
 * Builds content/games/logic.json: syllogisms, named fallacies, ordering puzzles and small truth/lie puzzles.
 * Deterministic (seeded), so running it twice gives the same file. Run: pnpm --filter tools exec tsx src/games/logic-gen.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Item = { id: string; kind: "syllogism" | "fallacy" | "order" | "puzzle"; level: 1 | 2 | 3; prompt: string; options: string[]; answer: string; why: string };

const items: Item[] = [];
const FOLLOWS = "Follows";
const NOT = "Doesn't follow";

function syl(id: string, level: 1 | 2 | 3, premises: string, conclusion: string, valid: boolean, why: string) {
  items.push({ id, kind: "syllogism", level, prompt: `${premises}\nSo: ${conclusion}`, options: [FOLLOWS, NOT], answer: valid ? FOLLOWS : NOT, why });
}

syl("syl-1", 1, "All cats are animals. Tom is a cat.", "Tom is an animal.", true, "Tom belongs to a group that sits inside \"animals\", so he is one too.");
syl("syl-2", 1, "All birds have feathers. A robin is a bird.", "A robin has feathers.", true, "What is true of every bird is true of a robin.");
syl("syl-3", 1, "All fish live in water. A dolphin lives in water.", "A dolphin is a fish.", false, "Living in water is not only for fish. A dolphin is a mammal. Sharing a trait doesn't put you in the group.");
syl("syl-4", 1, "All roses are flowers. Some flowers fade quickly.", "Some roses fade quickly.", false, "The flowers that fade quickly might not be roses at all.");
syl("syl-5", 1, "No reptiles are mammals. A snake is a reptile.", "A snake is not a mammal.", true, "If the two groups never overlap, a member of one can't be in the other.");
syl("syl-6", 2, "If it rains, the street is wet. It rained.", "The street is wet.", true, "This is the basic move: the condition happened, so the result follows.");
syl("syl-7", 2, "If it rains, the street is wet. The street is wet.", "It rained.", false, "A street can be wet for other reasons: a sprinkler, a burst pipe. The result doesn't prove the cause.");
syl("syl-8", 2, "If it rains, the street is wet. The street is dry.", "It did not rain.", true, "If rain always makes it wet, a dry street means no rain. This move is valid.");
syl("syl-9", 2, "If I study, I pass. I did not study.", "I will not pass.", false, "You might pass another way. The rule says what studying brings, not that nothing else can.");
syl("syl-10", 2, "All doctors are graduates. Maria is a graduate.", "Maria is a doctor.", false, "Many graduates aren't doctors. The rule only runs one way.");
syl("syl-11", 2, "Every square is a rectangle. Every rectangle has four sides.", "Every square has four sides.", true, "Chain the groups: squares sit inside rectangles, which sit inside four-sided shapes.");
syl("syl-12", 3, "Some artists are teachers. All teachers are patient.", "Some artists are patient.", true, "At least one artist is a teacher, and every teacher is patient, so that artist is patient.");
syl("syl-13", 3, "Some cars are electric. Some electric things are cheap.", "Some cars are cheap.", false, "The electric things that are cheap could all be bikes. The two \"some\" groups need not meet.");
syl("syl-14", 3, "No honest person lies. Some politicians lie.", "Some politicians are not honest.", true, "A politician who lies can't be honest, because honest people never lie.");
syl("syl-15", 3, "All members can enter. Sam can enter.", "Sam is a member.", false, "Guests, staff and others might be able to enter too.");
syl("syl-16", 3, "If the alarm rings, everyone leaves. Nobody left.", "The alarm did not ring.", true, "If ringing always empties the building, nobody leaving means it didn't ring.");

const FALLACIES = ["Ad hominem", "Straw man", "False dilemma", "Slippery slope", "Circular reasoning", "Appeal to popularity", "Hasty generalisation", "Post hoc"];

function fal(id: string, level: 1 | 2 | 3, argument: string, answer: string, why: string, wrong: string[]) {
  const options = [answer, ...wrong].sort();
  items.push({ id, kind: "fallacy", level, prompt: argument, options, answer, why });
}

fal("fal-1", 1, "\"Don't listen to her view on diets. She's not even a size 6.\"", "Ad hominem", "It attacks the person instead of the argument.", ["Straw man", "False dilemma", "Post hoc"]);
fal("fal-2", 1, "\"Everyone is buying this phone, so it must be the best.\"", "Appeal to popularity", "Lots of people doing something doesn't make it good.", ["Ad hominem", "Slippery slope", "Circular reasoning"]);
fal("fal-3", 1, "\"I met two rude tourists, so tourists are rude.\"", "Hasty generalisation", "Two examples are too few to describe a whole group.", ["Straw man", "False dilemma", "Post hoc"]);
fal("fal-4", 1, "\"You're either with us or against us.\"", "False dilemma", "It offers two options when there are more.", ["Slippery slope", "Ad hominem", "Circular reasoning"]);
fal("fal-5", 2, "\"I wore my lucky socks and we won. The socks made us win.\"", "Post hoc", "Coming after something isn't the same as being caused by it.", ["Straw man", "Appeal to popularity", "Circular reasoning"]);
fal("fal-6", 2, "\"If we allow one late homework, soon nobody will hand anything in on time.\"", "Slippery slope", "It claims a small step leads to disaster without showing the steps in between.", ["False dilemma", "Ad hominem", "Hasty generalisation"]);
fal("fal-7", 2, "\"The book is true because it says so on page one.\"", "Circular reasoning", "The conclusion is used as its own proof.", ["Straw man", "Post hoc", "Appeal to popularity"]);
fal("fal-8", 2, "A: \"We should spend more on libraries.\" B: \"So you want to cut money from hospitals?\"", "Straw man", "B swaps A's point for an easier one to attack.", ["Ad hominem", "False dilemma", "Slippery slope"]);
fal("fal-9", 3, "\"Crime rose after the new mayor took office, so the mayor caused it.\"", "Post hoc", "Other things changed too. Timing alone doesn't show cause.", ["Hasty generalisation", "Slippery slope", "Circular reasoning"]);
fal("fal-10", 3, "\"Of course the council is right. Councils are never wrong about this.\"", "Circular reasoning", "\"Right\" is just restated as \"never wrong\".", ["Appeal to popularity", "Ad hominem", "Straw man"]);
fal("fal-11", 3, "\"He's a banker, so his idea about climate can't be any good.\"", "Ad hominem", "The job is attacked, not the idea.", ["Straw man", "Post hoc", "False dilemma"]);
fal("fal-12", 3, "\"Either we ban cars completely or the planet burns.\"", "False dilemma", "There is a whole range between banning everything and doing nothing.", ["Slippery slope", "Straw man", "Hasty generalisation"]);

// Ordering puzzles: three or four things in a chain, ask for the top, bottom or middle.
let seed = 20260601;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(rnd() * xs.length)] as T;
}
function shuffled<T>(xs: readonly T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}
const NAMES = ["Ana", "Ben", "Cy", "Dee", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jo", "Kai", "Lea"];
const SCALES: { adj: string; hi: string; lo: string; than: string }[] = [
  { adj: "taller", hi: "tallest", lo: "shortest", than: "is taller than" },
  { adj: "older", hi: "oldest", lo: "youngest", than: "is older than" },
  { adj: "faster", hi: "fastest", lo: "slowest", than: "is faster than" },
  { adj: "heavier", hi: "heaviest", lo: "lightest", than: "is heavier than" },
];

for (let n = 0; n < 22; n++) {
  const level: 1 | 2 | 3 = n < 8 ? 1 : n < 15 ? 2 : 3;
  const count = level === 1 ? 3 : level === 2 ? 4 : 5;
  const names = shuffled(NAMES).slice(0, count); // names[0] is the top of the chain
  const scale = pick(SCALES);
  const facts = names.slice(0, -1).map((a, i) => `${a} ${scale.than} ${names[i + 1]}.`);
  // Shuffle the order the facts are shown in; at the top level one link is left implied by the others.
  const shown = shuffled(facts);
  const askTop = level === 1 || n % 2 === 0;
  const answer = askTop ? names[0]! : names[names.length - 1]!;
  const wrong = shuffled(names.filter((x) => x !== answer)).slice(0, 3);
  const options = shuffled([answer, ...wrong]);
  const why = names.slice(0, -1).map((a, i) => `${a} > ${names[i + 1]}`).join(", ") + `. So ${answer} is the ${askTop ? scale.hi : scale.lo}.`;
  items.push({ id: `ord-${n + 1}`, kind: "order", level, prompt: `${shown.join(" ")}\nWho is the ${askTop ? scale.hi : scale.lo}?`, options, answer, why });
}

function puz(id: string, level: 1 | 2 | 3, prompt: string, options: string[], answer: string, why: string) {
  items.push({ id, kind: "puzzle", level, prompt, options, answer, why });
}

puz("puz-1", 2, "Ana says: \"Ben and I both lie.\" Who is telling the truth?", ["Ben only", "Ana only", "Both", "Neither"], "Ben only", "If Ana told the truth she would be lying, which is impossible. So Ana lies, which means they do not both lie, so Ben tells the truth.");
puz("puz-2", 2, "A box holds only red and blue balls. You take out 3 balls and all are red. Which is certain?", ["The box has at least 3 red balls", "The box has more red than blue", "The next ball is red"], "The box has at least 3 red balls", "You held three red ones. Nothing else is guaranteed: the box could be mostly blue.");
puz("puz-3", 1, "Mia is in front of Leo in a queue. Leo is in front of Sam. Who is last?", ["Mia", "Leo", "Sam"], "Sam", "Mia, then Leo, then Sam.");
puz("puz-4", 3, "One of two doors is safe. The sign on door A says: \"A or B is safe.\" The sign on door B says: \"Door A is not safe.\" Exactly one sign is true. Which door is safe?", ["Door A", "Door B"], "Door A", "Door A's sign is always true, because one of the doors is safe. Exactly one sign is true, so door B's sign is false, which means door A is safe.");
puz("puz-5", 3, "Three friends each own a different pet: cat, dog, fish. Ana doesn't own the cat. Ben owns neither the dog nor the cat. Who owns the dog?", ["Ana", "Ben", "Cy"], "Ana", "Ben can only have the fish. Ana can't have the cat, so she has the dog. Cy has the cat.");
puz("puz-6", 3, "A farmer says: \"All my chickens are brown, and some of my animals are chickens.\" Which must be true?", ["Some of his animals are brown", "All his animals are brown", "Some chickens are not brown"], "Some of his animals are brown", "At least one animal is a chicken, and every chicken is brown.");

// More items, added after the generated ordering puzzles so the seeded content above never shifts.
syl("syl-17", 1, "All squares have four sides. This shape is a square.", "This shape has four sides.", true, "Being a square comes with four sides, so this shape has them.");
syl("syl-18", 1, "No dogs can fly. Rex is a dog.", "Rex can't fly.", true, "If no dog flies, Rex, being a dog, doesn't either.");
syl("syl-19", 1, "All teachers read a lot. Lena reads a lot.", "Lena is a teacher.", false, "Many people who aren't teachers read a lot too. The rule only runs one way.");
syl("syl-20", 2, "All apples are fruit. All fruit grows on plants.", "All apples grow on plants.", true, "Apples sit inside fruit, and fruit sits inside things that grow on plants.");
syl("syl-21", 2, "If you press the bell, it rings. The bell rang.", "Someone pressed it.", false, "A bell can ring for other reasons: wind, a fault, a timer. The result doesn't prove the cause.");
syl("syl-22", 2, "If a number is divisible by 4, it is even. 12 is divisible by 4.", "12 is even.", true, "The condition holds, so the result follows.");
syl("syl-23", 2, "If the shop is open, the lights are on. The lights are off.", "The shop is not open.", true, "If open always means lights on, lights off means not open.");
syl("syl-24", 3, "Some birds can't fly. All penguins are birds.", "Some penguins can't fly.", false, "The birds that can't fly might be ostriches and kiwis, not penguins. Nothing here links the two groups.");
syl("syl-25", 3, "No cats bark. Some pets are cats.", "Some pets don't bark.", true, "At least one pet is a cat, and no cat barks, so that pet doesn't bark.");
syl("syl-26", 3, "Everyone who finishes the race gets a medal. Some runners got a medal.", "Some runners finished the race.", false, "Medals might also go to other people, such as the oldest runner or a volunteer. The rule says what finishing brings, not that only finishing brings it.");

fal("fal-13", 1, "\"You can't trust his sums. He dropped out of school.\"", "Ad hominem", "It attacks the person instead of checking the sums.", ["Straw man", "Post hoc", "False dilemma"]);
fal("fal-14", 1, "\"It's the best film ever. Everyone I know has seen it.\"", "Appeal to popularity", "How many people watched it doesn't show how good it is.", ["Ad hominem", "Slippery slope", "Circular reasoning"]);
fal("fal-15", 1, "\"My cousin lost weight on this tea, so it works for everyone.\"", "Hasty generalisation", "One person's result can't tell you what happens for everyone.", ["Straw man", "False dilemma", "Circular reasoning"]);
fal("fal-16", 2, "A: \"We should have slightly shorter school days.\" B: \"So you think children shouldn't learn anything?\"", "Straw man", "B swaps A's modest point for an extreme one that is easy to attack.", ["False dilemma", "Ad hominem", "Post hoc"]);
fal("fal-17", 2, "\"If we let them build one tower, soon the whole skyline will be ruined.\"", "Slippery slope", "It jumps from one small step to a disaster with no steps shown in between.", ["Hasty generalisation", "Circular reasoning", "Straw man"]);
fal("fal-18", 2, "\"This medicine is safe because it isn't dangerous.\"", "Circular reasoning", "\"Safe\" and \"not dangerous\" say the same thing, so nothing has been shown.", ["Post hoc", "Ad hominem", "Appeal to popularity"]);
fal("fal-19", 3, "\"Every morning the rooster crows and then the sun rises. The rooster makes the sun rise.\"", "Post hoc", "Happening first doesn't make it the cause. Both follow the dawn's own timing.", ["Circular reasoning", "Hasty generalisation", "Straw man"]);
fal("fal-20", 3, "A: \"Let's check the data before we decide.\" B: \"So you want to delay the project forever?\"", "Straw man", "A asked for one check. B answers an exaggerated version of the point.", ["Ad hominem", "Circular reasoning", "Appeal to popularity"]);

puz("puz-7", 1, "Tom is taller than Ria. Ria is taller than Ed. Who is in the middle?", ["Tom", "Ria", "Ed"], "Ria", "Tom, then Ria, then Ed. Ria sits between them.");
puz("puz-8", 1, "One of three boxes holds a prize. Box 1 is empty. Box 2 is empty. Where is the prize?", ["Box 1", "Box 2", "Box 3"], "Box 3", "Rule out the empty ones and one box is left.");
puz("puz-9", 2, "A is older than B. C is younger than B. D is older than A. Who is the youngest?", ["A", "B", "C", "D"], "C", "From oldest: D, A, B, C. So C is the youngest.");
puz("puz-10", 2, "If today is Monday, the library is closed. The library is open today. What do you know?", ["Today is not Monday", "Today is Monday", "Today is Sunday"], "Today is not Monday", "If Monday always means closed, then open means it can't be Monday. It doesn't say which day it is.");
puz("puz-11", 3, "Two doors: one is safe. Two guards, one always lies and one always tells the truth. You ask one guard: \"What would the other guard say is the safe door?\" He points to door A. Which door is safe?", ["Door A", "Door B"], "Door B", "The truth-teller reports the liar's lie, and the liar lies about the truth-teller's answer. Either way you hear the wrong door, so take the other one.");
puz("puz-12", 3, "A shirt and a tie cost $11 together. The shirt costs $10 more than the tie. How much does the tie cost?", ["$0.50", "$1", "$0.10"], "$0.50", "Shirt $10.50 plus tie $0.50 makes $11, and the difference is $10. The quick answer, $1, would make the total $12.");

const out = resolve(import.meta.dirname, "../../../content/games/logic.json");
writeFileSync(out, JSON.stringify({ fallacies: FALLACIES, items }, null, 1) + "\n");
console.log(`wrote ${items.length} logic items to ${out}`);
