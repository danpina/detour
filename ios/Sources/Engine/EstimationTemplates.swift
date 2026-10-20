import Foundation

// Generated from content/estimation-templates.json by tools/src/gen-estimation.ts. Do not edit by hand.

struct EstimationTemplate {
    enum Param {
        case pick(String, [Int])
        case range(String, Int, Int)
    }

    enum Term {
        case param(String)
        case constant(Int)
    }

    let level: Int
    let text: String
    let params: [Param]
    let mult: [Term]
}

enum EstimationTemplates {
    static let levels: [String] = ["Everyday totals","Rates over time","Volumes and fitting things in","Fermi chains"]

    static let all: [EstimationTemplate] = [
        EstimationTemplate(level: 1, text: "A bakery bakes {a} loaves a day. How many loaves is that in a year (365 days)?", params: [.pick("a", [120, 150, 200, 250, 400])], mult: [.param("a"), .constant(365)]),
        EstimationTemplate(level: 1, text: "A café sells {a} cups of coffee a day. A chain has {b} cafés like it. How many cups does the chain sell in a week?", params: [.pick("a", [60, 80, 150, 300]), .range("b", 3, 9)], mult: [.param("a"), .param("b"), .constant(7)]),
        EstimationTemplate(level: 1, text: "A jet seats {a} people and flies {b} full flights a day. How many passengers is that in a month (30 days)?", params: [.pick("a", [180, 300, 400]), .range("b", 3, 12)], mult: [.param("a"), .param("b"), .constant(30)]),
        EstimationTemplate(level: 1, text: "A pizzeria bakes {a} pizzas an evening and opens {b} evenings a week. How many pizzas is that in a year (52 weeks)?", params: [.pick("a", [40, 60, 80, 120]), .range("b", 4, 7)], mult: [.param("a"), .param("b"), .constant(52)]),
        EstimationTemplate(level: 1, text: "A bus carries {a} passengers per trip and makes {b} trips a day. How many passengers is that in a week?", params: [.pick("a", [30, 45, 60]), .range("b", 8, 20)], mult: [.param("a"), .param("b"), .constant(7)]),
        EstimationTemplate(level: 1, text: "A library lends {a} books a day and is open {b} days a month. How many books is that in a year (12 months)?", params: [.pick("a", [150, 200, 350, 500]), .range("b", 20, 27)], mult: [.param("a"), .param("b"), .constant(12)]),
        EstimationTemplate(level: 1, text: "A newspaper prints {a} copies a day. How many copies is that in {b} years (365 days a year)?", params: [.pick("a", [10000, 20000, 50000]), .range("b", 2, 9)], mult: [.param("a"), .param("b"), .constant(365)]),
        EstimationTemplate(level: 1, text: "A bike shop sells {a} bikes a week. How many bikes is that in {b} years (52 weeks a year)?", params: [.pick("a", [8, 12, 20, 30]), .range("b", 2, 9)], mult: [.param("a"), .param("b"), .constant(52)]),
        EstimationTemplate(level: 1, text: "A school serves {a} lunches a day, {b} days a week. How many lunches is that in a 40-week school year?", params: [.pick("a", [300, 500, 800, 1200]), .pick("b", [4, 5])], mult: [.param("a"), .param("b"), .constant(40)]),
        EstimationTemplate(level: 1, text: "A farm's hens lay {a} eggs a day. How many eggs is that in {b} weeks?", params: [.pick("a", [200, 500, 800, 1500]), .range("b", 2, 9)], mult: [.param("a"), .param("b"), .constant(7)]),
        EstimationTemplate(level: 1, text: "A stadium holds {a} fans and hosts {b} games a season. If every seat is filled, how many tickets are sold in {c} seasons?", params: [.pick("a", [20000, 40000, 60000]), .range("b", 10, 20), .range("c", 2, 5)], mult: [.param("a"), .param("b"), .param("c")]),
        EstimationTemplate(level: 1, text: "A laundromat runs {a} loads a day. How many loads is that in {b} weeks?", params: [.pick("a", [60, 90, 120, 200]), .range("b", 2, 9)], mult: [.param("a"), .param("b"), .constant(7)]),
        EstimationTemplate(level: 1, text: "A roastery packs {a} bags of coffee a day, {b} days a week. How many bags is that in a year (52 weeks)?", params: [.pick("a", [250, 400, 600, 900]), .pick("b", [5, 6])], mult: [.param("a"), .param("b"), .constant(52)]),
        EstimationTemplate(level: 2, text: "A heart beats {a} times a minute. How many beats in {b} days?", params: [.pick("a", [60, 70, 80]), .range("b", 2, 9)], mult: [.param("a"), .constant(60), .constant(24), .param("b")]),
        EstimationTemplate(level: 2, text: "A tap drips {a} drops every second. How many drops in {b} weeks?", params: [.pick("a", [2, 3, 5]), .range("b", 2, 8)], mult: [.param("a"), .constant(604800), .param("b")]),
        EstimationTemplate(level: 2, text: "Someone walks {a} km every hour without stopping. How many metres in {b} hours?", params: [.pick("a", [4, 5, 6]), .range("b", 5, 40)], mult: [.param("a"), .constant(1000), .param("b")]),
        EstimationTemplate(level: 2, text: "A person breathes about {a} times a minute. How many breaths in {b} days?", params: [.pick("a", [12, 14, 16, 18]), .range("b", 2, 9)], mult: [.param("a"), .constant(1440), .param("b")]),
        EstimationTemplate(level: 2, text: "Someone blinks {a} times a minute while awake, about {b} hours a day. How many blinks in a week?", params: [.pick("a", [12, 15, 20]), .pick("b", [14, 16, 18])], mult: [.param("a"), .constant(60), .param("b"), .constant(7)]),
        EstimationTemplate(level: 2, text: "A writer types {a} words an hour for {b} hours a day. How many words in {c} days?", params: [.pick("a", [800, 1200, 1500, 2000]), .range("b", 2, 6), .range("c", 5, 30)], mult: [.param("a"), .param("b"), .param("c")]),
        EstimationTemplate(level: 2, text: "A printer prints {a} pages a minute. How many pages in {b} hours?", params: [.pick("a", [15, 20, 30, 40]), .range("b", 2, 9)], mult: [.param("a"), .constant(60), .param("b")]),
        EstimationTemplate(level: 2, text: "A shower uses {a} litres a minute. A family showers {b} minutes a day in total. How many litres in {c} days?", params: [.pick("a", [8, 10, 12]), .pick("b", [30, 40, 60]), .range("c", 7, 30)], mult: [.param("a"), .param("b"), .param("c")]),
        EstimationTemplate(level: 2, text: "A factory makes {a} bottles a minute. How many bottles in {b} hours?", params: [.pick("a", [200, 500, 800, 1000]), .range("b", 2, 9)], mult: [.param("a"), .constant(60), .param("b")]),
        EstimationTemplate(level: 2, text: "A river carries {a} cubic metres of water every second. How many cubic metres in {b} hours?", params: [.pick("a", [10, 50, 200]), .range("b", 2, 9)], mult: [.param("a"), .constant(3600), .param("b")]),
        EstimationTemplate(level: 2, text: "A teenager sends {a} texts a day. How many texts in {b} years (365 days a year)?", params: [.pick("a", [50, 80, 120, 200]), .range("b", 2, 9)], mult: [.param("a"), .param("b"), .constant(365)]),
        EstimationTemplate(level: 2, text: "A clock ticks once a second. How many ticks in {a} hours?", params: [.range("a", 2, 12)], mult: [.param("a"), .constant(3600)]),
        EstimationTemplate(level: 2, text: "A conveyor belt moves {a} boxes a minute. How many boxes in {b} days of {c} hours each?", params: [.pick("a", [10, 20, 30, 45]), .range("b", 2, 9), .pick("c", [8, 12, 24])], mult: [.param("a"), .constant(60), .param("b"), .param("c")]),
        EstimationTemplate(level: 3, text: "A cube is {a} m on each side. How many 1-litre bottles of water fit in it? (1 m³ = 1,000 litres)", params: [.range("a", 2, 9)], mult: [.param("a"), .param("a"), .param("a"), .constant(1000)]),
        EstimationTemplate(level: 3, text: "A room is {a} m × {b} m with a {c} m ceiling. How many 1-litre bottles of air would fill it? (1 m³ = 1,000 litres)", params: [.range("a", 2, 6), .range("b", 2, 8), .range("c", 2, 5)], mult: [.param("a"), .param("b"), .param("c"), .constant(1000)]),
        EstimationTemplate(level: 3, text: "How many 1 cm cubes fit inside a cube that is {a} m on each side? (1 m = 100 cm)", params: [.range("a", 2, 6)], mult: [.param("a"), .param("a"), .param("a"), .constant(1000000)]),
        EstimationTemplate(level: 3, text: "A swimming pool is {a} m long, {b} m wide and {c} m deep. How many 1-litre bottles of water would fill it? (1 m³ = 1,000 litres)", params: [.pick("a", [10, 25, 50]), .pick("b", [5, 10, 20]), .range("c", 1, 3)], mult: [.param("a"), .param("b"), .param("c"), .constant(1000)]),
        EstimationTemplate(level: 3, text: "A shipping box is {a} cm × {b} cm × {c} cm. How many 1 cm cubes fit inside it?", params: [.pick("a", [20, 30, 40, 50]), .pick("b", [10, 20, 30]), .range("c", 5, 20)], mult: [.param("a"), .param("b"), .param("c")]),
        EstimationTemplate(level: 3, text: "A bookshelf holds {a} books per shelf and has {b} shelves. How many books fit on {c} bookshelves?", params: [.pick("a", [25, 30, 40]), .range("b", 4, 8), .range("c", 5, 20)], mult: [.param("a"), .param("b"), .param("c")]),
        EstimationTemplate(level: 3, text: "A parking garage has {a} floors with {b} spaces each. How many cars fit in {c} such garages?", params: [.range("a", 3, 10), .pick("b", [50, 80, 120]), .range("c", 2, 9)], mult: [.param("a"), .param("b"), .param("c")]),
        EstimationTemplate(level: 3, text: "An egg carton holds {a} eggs. A box holds {b} cartons and a pallet holds {c} boxes. How many eggs fit on one pallet?", params: [.pick("a", [6, 12, 18]), .pick("b", [10, 12, 20]), .range("c", 20, 60)], mult: [.param("a"), .param("b"), .param("c")]),
        EstimationTemplate(level: 3, text: "A tanker holds {a} thousand litres. How many litres do {b} tankers hold?", params: [.pick("a", [20, 30, 40]), .range("b", 3, 12)], mult: [.param("a"), .constant(1000), .param("b")]),
        EstimationTemplate(level: 3, text: "A classroom has {a} rows of {b} desks. How many desks are there in a school with {c} classrooms?", params: [.range("a", 4, 8), .range("b", 4, 8), .range("c", 10, 40)], mult: [.param("a"), .param("b"), .param("c")]),
        EstimationTemplate(level: 3, text: "A container ship stacks {a} containers across, {b} along and {c} high. How many containers is that?", params: [.range("a", 10, 20), .range("b", 20, 40), .range("c", 5, 9)], mult: [.param("a"), .param("b"), .param("c")]),
        EstimationTemplate(level: 3, text: "A water tank holds {a} cubic metres. How many 1-litre bottles of water is that? (1 m³ = 1,000 litres)", params: [.pick("a", [50, 200, 500, 2000])], mult: [.param("a"), .constant(1000)]),
        EstimationTemplate(level: 3, text: "A warehouse floor is {a} m long and {b} m wide. How many square metres of floor are there in a building with {c} such floors?", params: [.pick("a", [50, 80, 120]), .pick("b", [20, 30, 50]), .range("c", 2, 6)], mult: [.param("a"), .param("b"), .param("c")]),
        EstimationTemplate(level: 4, text: "A city has {a} million people and each drinks {b} litres of water a day. How many litres does it drink in a year (365 days)?", params: [.range("a", 2, 9), .pick("b", [2, 3])], mult: [.param("a"), .constant(1000000), .param("b"), .constant(365)]),
        EstimationTemplate(level: 4, text: "A school has {a} students. Each sends {b} messages a day, and the school year has 180 days. How many messages in a school year?", params: [.pick("a", [400, 800, 1200, 2000]), .pick("b", [20, 30, 50])], mult: [.param("a"), .param("b"), .constant(180)]),
        EstimationTemplate(level: 4, text: "A town has {a} thousand cars. Each drives {b} km a day. How many km in a 30-day month?", params: [.range("a", 2, 8), .pick("b", [30, 40, 50])], mult: [.param("a"), .constant(1000), .param("b"), .constant(30)]),
        EstimationTemplate(level: 4, text: "A country has {a} million households and each throws away {b} kilograms of food a week. How many kilograms in a year (52 weeks)?", params: [.range("a", 5, 40), .pick("b", [2, 3, 4, 5])], mult: [.param("a"), .constant(1000000), .param("b"), .constant(52)]),
        EstimationTemplate(level: 4, text: "A big city has {a} thousand taxis, each making {b} trips a day. How many trips in a year (365 days)?", params: [.range("a", 5, 30), .pick("b", [20, 25, 30])], mult: [.param("a"), .constant(1000), .param("b"), .constant(365)]),
        EstimationTemplate(level: 4, text: "{b} million people unlock their phone {a} times a day. How many unlocks in a year (365 days)?", params: [.pick("a", [50, 80, 100]), .range("b", 5, 90)], mult: [.param("a"), .param("b"), .constant(1000000), .constant(365)]),
        EstimationTemplate(level: 4, text: "An airport handles {a} flights a day, each carrying {b} passengers. How many passengers in a year (365 days)?", params: [.pick("a", [400, 600, 900]), .pick("b", [120, 150, 180])], mult: [.param("a"), .param("b"), .constant(365)]),
        EstimationTemplate(level: 4, text: "A supermarket chain has {a} stores. Each sells {b} loaves of bread a day. How many loaves in a year (365 days)?", params: [.pick("a", [50, 120, 300, 900]), .pick("b", [200, 350, 500])], mult: [.param("a"), .param("b"), .constant(365)]),
        EstimationTemplate(level: 4, text: "A video is watched {a} million times a day, for {b} minutes each time. How many minutes of it are watched in a week?", params: [.range("a", 2, 50), .pick("b", [3, 4, 5, 8])], mult: [.param("a"), .constant(1000000), .param("b"), .constant(7)]),
        EstimationTemplate(level: 4, text: "A coffee chain serves {a} million cups a day. How many cups in a year (365 days)?", params: [.range("a", 2, 9)], mult: [.param("a"), .constant(1000000), .constant(365)]),
        EstimationTemplate(level: 4, text: "A rail network has {a} million commuters, each making {b} trips a week. How many trips in a year (52 weeks)?", params: [.range("a", 2, 9), .pick("b", [8, 10, 12])], mult: [.param("a"), .constant(1000000), .param("b"), .constant(52)]),
        EstimationTemplate(level: 4, text: "A power station produces {a} megawatt-hours a day. How many megawatt-hours in {b} years (365 days a year)?", params: [.pick("a", [500, 2000, 10000]), .range("b", 2, 9)], mult: [.param("a"), .param("b"), .constant(365)]),
        EstimationTemplate(level: 4, text: "A website gets {a} thousand visits an hour. How many visits in {b} days?", params: [.pick("a", [5, 20, 60]), .range("b", 2, 30)], mult: [.param("a"), .constant(1000), .constant(24), .param("b")]),
    ]
}
