import SwiftUI

/// Find countries, rivers and mountains by tapping the map. Drag to move and pinch to zoom.
/// When `embedded` is set the game is played inside a set of cards: no setup, no end screen, Skip calls onExit.
struct MapGameView: View {
    let onExit: () -> Void
    var embedded: ((Int) -> Void)? = nil

    @State private var data: MapData?
    @State private var failed = false
    @State private var settings = MapSettings.load()
    @State private var setup: Bool
    @State private var run = 0

    init(onExit: @escaping () -> Void, embedded: ((Int) -> Void)? = nil) {
        self.onExit = onExit
        self.embedded = embedded
        _setup = State(initialValue: embedded == nil)
    }

    var body: some View {
        Group {
            if failed {
                VStack(spacing: 16) {
                    Spacer()
                    Text("The map isn't available right now.").foregroundStyle(.secondary)
                    Button(embedded == nil ? "Back" : "Skip", action: onExit).buttonStyle(.borderedProminent)
                    Spacer()
                }
            } else if let data {
                if setup {
                    MapSetupView(settings: settings, onExit: onExit) { chosen in
                        settings = chosen
                        chosen.save()
                        setup = false
                        run += 1
                    }
                } else {
                    MapRoundView(data: data, settings: settings, onExit: onExit, embedded: embedded, onSettings: { setup = true })
                        .id(run)
                }
            } else {
                ProgressView("Loading the map…")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task {
            guard data == nil else { return }
            let loaded = await Task.detached { MapStore.load() }.value
            if let loaded { data = loaded } else { failed = true }
        }
    }
}

// MARK: - Setup

private struct MapSetupView: View {
    @State var settings: MapSettings
    let onExit: () -> Void
    let onStart: (MapSettings) -> Void

    init(settings: MapSettings, onExit: @escaping () -> Void, onStart: @escaping (MapSettings) -> Void) {
        _settings = State(initialValue: settings)
        self.onExit = onExit
        self.onStart = onStart
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button("Back", action: onExit).frame(minHeight: 44)
            Text("Find it on the map").font(.largeTitle.weight(.semibold)).padding(.top, 4)
            Text("Tap where it is. Pick what to look for and where.").foregroundStyle(.secondary).padding(.top, 6)

            Text("What to find").font(.subheadline.weight(.medium)).foregroundStyle(.secondary).padding(.top, 22)
            Picker("What to find", selection: $settings.subject) {
                ForEach(MapSubject.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.menu)
            .padding(.top, 2)

            Text("Where").font(.subheadline.weight(.medium)).foregroundStyle(.secondary).padding(.top, 14)
            Picker("Where", selection: $settings.region) {
                ForEach(MapRegion.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.menu)
            .padding(.top, 2)

            Text("How hard").font(.subheadline.weight(.medium)).foregroundStyle(.secondary).padding(.top, 14)
            Picker("How hard", selection: $settings.difficulty) {
                ForEach([1, 2, 3], id: \.self) { Text(MapSettings.difficultyName($0)).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.top, 6)
            Text("Easy asks about the big ones first. Hard includes the small countries.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .padding(.top, 6)

            Spacer()

            Button {
                onStart(settings)
            } label: {
                Text("Start").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 16)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(24)
    }
}

// MARK: - A round

private struct MapShape: Identifiable {
    let id: String
    let name: String
    let path: Path
}

private struct MapRoundView: View {
    let data: MapData
    let settings: MapSettings
    let onExit: () -> Void
    let embedded: ((Int) -> Void)?
    let onSettings: () -> Void

    @State private var round: [MapTarget] = []
    @State private var index = 0
    @State private var score = 0
    @State private var tap: CGPoint?
    @State private var verdict: MapVerdict?
    @State private var isBest = false
    @State private var started = false

    @State private var shapes: [MapShape] = []
    @State private var riverPaths: [String: Path] = [:]
    @State private var box = CGRect.zero
    @State private var home = CGRect.zero
    @State private var dragLast = CGSize.zero
    @State private var dragMoved = false
    @State private var pinchStartWidth: CGFloat?

    private var showRivers: Bool { settings.subject == .rivers || settings.subject == .mixed }
    private var showMountains: Bool { settings.subject == .mountains || settings.subject == .mixed }

    var body: some View {
        VStack(spacing: 0) {
            if !started {
                ProgressView()
            } else if round.isEmpty {
                nothingToAsk
            } else if index >= round.count {
                if embedded == nil { finished }
            } else {
                question(round[index])
            }
        }
        .onAppear(perform: start)
    }

    // MARK: Setup of the round

    private func start() {
        guard !started else { return }
        shapes = data.countries.map { MapShape(id: $0.id, name: $0.name, path: Self.path(rings: $0.rings, closed: true)) }
        riverPaths = Dictionary(uniqueKeysWithValues: data.rivers.map { river -> (String, Path) in
            var p = Path()
            for line in river.lines { p.addPath(Self.path(rings: [line], closed: false)) }
            return (river.name, p)
        })
        let b = MapLogic.regionBox(data, region: settings.region)
        home = CGRect(x: b.x, y: b.y, width: b.w, height: b.h)
        box = home
        var rng = SystemRandomNumberGenerator()
        round = MapLogic.round(data, settings: settings, length: GameStats.size(embedded: embedded != nil), using: &rng)
        started = true
    }

    private static func path(rings: [[Int]], closed: Bool) -> Path {
        var path = Path()
        for ring in rings where ring.count >= 4 {
            path.move(to: CGPoint(x: ring[0], y: ring[1]))
            var i = 2
            while i + 1 < ring.count {
                path.addLine(to: CGPoint(x: ring[i], y: ring[i + 1]))
                i += 2
            }
            if closed { path.closeSubpath() }
        }
        return path
    }

    private func again() {
        var rng = SystemRandomNumberGenerator()
        round = MapLogic.round(data, settings: settings, length: GameStats.size(embedded: embedded != nil), using: &rng)
        index = 0
        score = 0
        verdict = nil
        tap = nil
        isBest = false
        box = home
    }

    // MARK: Screens

    private var nothingToAsk: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("There is nothing to ask about here. Try another region.").foregroundStyle(.secondary).multilineTextAlignment(.center)
            Button(embedded == nil ? "Change region" : "Skip", action: embedded == nil ? onSettings : onExit).buttonStyle(.borderedProminent)
            Spacer()
        }
        .padding(24)
    }

    private var endLine: String {
        let total = round.count
        if score == total { return "A true navigator. Not one miss." }
        if Double(score) >= Double(total) * 0.7 { return "You know your way around." }
        if Double(score) >= Double(total) * 0.4 { return "Good run. Maps stick the more you look." }
        return "Every miss is a place you'll remember next time."
    }

    private var finished: some View {
        VStack(spacing: 18) {
            Spacer()
            Text("🗺️").font(.system(size: 64)).accessibilityHidden(true)
            Text("\(score) / \(round.count)").font(.largeTitle.weight(.semibold))
            Text(endLine).foregroundStyle(.secondary).multilineTextAlignment(.center)
            if isBest { Text("New best!").font(.subheadline.weight(.medium)).foregroundStyle(.tint) }
            Spacer()
            VStack(spacing: 12) {
                Button(action: again) { Text("Play again").font(.headline).frame(maxWidth: .infinity, minHeight: 52) }
                    .buttonStyle(.borderedProminent)
                Button(action: onSettings) { Text("Change the map").font(.headline).frame(maxWidth: .infinity, minHeight: 52) }
                    .buttonStyle(.bordered)
                Button("Back", action: onExit).frame(minHeight: 44)
            }
            .padding(.bottom, 24)
        }
        .padding(.horizontal, 24)
    }

    private func question(_ target: MapTarget) -> some View {
        let answered = verdict != nil
        let isLast = index == round.count - 1
        return VStack(spacing: 0) {
            HStack {
                if embedded != nil {
                    Text("A little geography").fontWeight(.medium).frame(minHeight: 44)
                    Spacer()
                    Text("\(index + 1) / \(round.count)")
                    Spacer()
                    Button("Skip", action: onExit).frame(minHeight: 44)
                } else {
                    Button("Back", action: onExit).frame(minHeight: 44)
                    Spacer()
                    Text("\(index + 1) / \(round.count)")
                    Spacer()
                    Text("Score \(score)")
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 20)

            GameProgressBar(done: index + (answered ? 1 : 0), total: round.count)
                .padding(.horizontal, 20)
                .padding(.top, 4)

            VStack(spacing: 2) {
                Text(target.subjectWord).font(.subheadline).foregroundStyle(.secondary)
                Text(target.prompt).font(.title.weight(.semibold)).multilineTextAlignment(.center)
            }
            .padding(.top, 10)

            mapView(target)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding(.horizontal, 12)
                .padding(.top, 10)

            VStack(spacing: 8) {
                if let verdict {
                    Text(resultText(verdict, target)).font(.headline).multilineTextAlignment(.center)
                    Button(action: { next(isLast: isLast) }) {
                        Text(isLast ? (embedded != nil ? "Continue" : "See my score") : "Next").font(.headline).frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.borderedProminent)
                } else {
                    Text("Tap the map where you think it is. Drag or pinch to move and zoom.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 96, alignment: .top)
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 8)
        }
        .answerHaptic(picked: answered, correct: verdict?.correct ?? false)
    }

    private func resultText(_ verdict: MapVerdict, _ target: MapTarget) -> String {
        if verdict.correct { return "Yes, that's \(target.name)." }
        if let tapped = verdict.tapped { return "That's \(tapped). \(target.name) is marked in green." }
        return "Not quite. \(target.name) is marked in green."
    }

    private func next(isLast: Bool) {
        if isLast {
            if let done = embedded {
                GameStats.recordRound(.map, score: score)
                done(score)
                return
            }
            isBest = GameStats.recordRound(.map, score: score)
        }
        index += 1
        verdict = nil
        tap = nil
    }

    // MARK: The map

    /// Screen points per map unit, and where the map starts, for a canvas of this size.
    private func fit(_ size: CGSize) -> (scale: CGFloat, ox: CGFloat, oy: CGFloat) {
        guard box.width > 0, box.height > 0 else { return (1, 0, 0) }
        let s = min(size.width / box.width, size.height / box.height)
        return (s, (size.width - box.width * s) / 2, (size.height - box.height * s) / 2)
    }

    private func clamp(x: CGFloat, y: CGFloat, width: CGFloat) -> CGRect {
        let w = max(500, min(CGFloat(data.w), width))
        let h = w * (home.height / home.width)
        return CGRect(x: max(0, min(CGFloat(data.w) - w, x)), y: max(0, min(CGFloat(data.h) - h, y)), width: w, height: h)
    }

    private func zoomBy(_ factor: CGFloat) {
        let w = box.width * factor
        let h = w * (box.height / box.width)
        box = clamp(x: box.midX - w / 2, y: box.midY - h / 2, width: w)
    }

    private func mapPoint(_ location: CGPoint, in size: CGSize) -> CGPoint {
        let f = fit(size)
        return CGPoint(x: box.minX + (location.x - f.ox) / f.scale, y: box.minY + (location.y - f.oy) / f.scale)
    }

    private func mapView(_ target: MapTarget) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .topTrailing) {
                Color(.systemTeal).opacity(0.10)
                Canvas { context, size in
                    draw(context, size, target)
                }
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            if !dragMoved && hypot(value.translation.width, value.translation.height) < 6 { return }
                            dragMoved = true
                            let f = fit(geo.size)
                            let dx = value.translation.width - dragLast.width
                            let dy = value.translation.height - dragLast.height
                            dragLast = value.translation
                            box = clamp(x: box.minX - dx / f.scale, y: box.minY - dy / f.scale, width: box.width)
                        }
                        .onEnded { value in
                            if !dragMoved && verdict == nil {
                                let p = mapPoint(value.location, in: geo.size)
                                let v = MapLogic.judge(data, target: target, x: Double(p.x), y: Double(p.y))
                                tap = p
                                verdict = v
                                if v.correct { score += 1 }
                            }
                            dragMoved = false
                            dragLast = .zero
                        }
                )
                .simultaneousGesture(
                    MagnifyGesture()
                        .onChanged { value in
                            if pinchStartWidth == nil { pinchStartWidth = box.width }
                            let w = (pinchStartWidth ?? box.width) / max(0.2, value.magnification)
                            let h = w * (box.height / box.width)
                            box = clamp(x: box.midX - w / 2, y: box.midY - h / 2, width: w)
                        }
                        .onEnded { _ in pinchStartWidth = nil }
                )

                VStack(spacing: 6) {
                    zoomButton("plus", label: "Zoom in") { zoomBy(0.6) }
                    zoomButton("minus", label: "Zoom out") { zoomBy(1 / 0.6) }
                    zoomButton("arrow.counterclockwise", label: "Show the whole region") { box = home }
                }
                .padding(8)
            }
        }
    }

    private func zoomButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.subheadline.weight(.semibold))
                .frame(width: 44, height: 44)
                .background(.regularMaterial, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func isRiver(_ target: MapTarget, _ name: String) -> Bool {
        if case .river(let r) = target { return r.name == name }
        return false
    }

    private func isMountain(_ target: MapTarget, _ name: String) -> Bool {
        if case .mountain(let m) = target { return m.name == name }
        return false
    }

    private func draw(_ context: GraphicsContext, _ size: CGSize, _ target: MapTarget) {
        let f = fit(size)
        var c = context
        c.translateBy(x: f.ox, y: f.oy)
        c.scaleBy(x: f.scale, y: f.scale)
        c.translateBy(x: -box.minX, y: -box.minY)
        let pt = 1 / f.scale // one screen point, in map units
        let answered = verdict != nil
        let green = Color(red: 0.06, green: 0.73, blue: 0.51)
        let red = Color(red: 0.88, green: 0.2, blue: 0.3)

        for shape in shapes {
            var fill = Color(.systemGray4)
            if answered, case .country(let t) = target, t.id == shape.id { fill = green }
            else if answered, verdict?.correct == false, verdict?.tapped == shape.name { fill = red.opacity(0.7) }
            c.fill(shape.path, with: .color(fill))
            c.stroke(shape.path, with: .color(Color(.systemBackground)), lineWidth: 0.6 * pt)
        }

        if showRivers {
            for river in data.rivers {
                let hot = answered && isRiver(target, river.name)
                let wasTapped = answered && verdict?.correct == false && verdict?.tapped == river.name
                let colour = hot ? green : (wasTapped ? red : Color.blue.opacity(0.55))
                if let path = riverPaths[river.name] {
                    c.stroke(path, with: .color(colour), style: StrokeStyle(lineWidth: (hot || wasTapped ? 3 : 1.5) * pt, lineCap: .round, lineJoin: .round))
                }
            }
        }

        if showMountains {
            for mountain in data.mountains {
                let hot = answered && isMountain(target, mountain.name)
                let wasTapped = answered && verdict?.correct == false && verdict?.tapped == mountain.name
                let colour = hot ? green : (wasTapped ? red : Color.brown.opacity(0.85))
                if let spine = mountain.line {
                    // A range is drawn along its spine, like a river, in the colour of mountains.
                    c.stroke(Self.path(rings: [spine], closed: false), with: .color(hot || wasTapped ? colour : Color.brown.opacity(0.6)), style: StrokeStyle(lineWidth: (hot || wasTapped ? 6 : 4) * pt, lineCap: .round, lineJoin: .round))
                    continue
                }
                let r = 5.0 * pt
                let x = Double(mountain.at[0]), y = Double(mountain.at[1])
                var tri = Path()
                tri.move(to: CGPoint(x: x, y: y - r))
                tri.addLine(to: CGPoint(x: x + r, y: y + r * 0.8))
                tri.addLine(to: CGPoint(x: x - r, y: y + r * 0.8))
                tri.closeSubpath()
                c.fill(tri, with: .color(colour))
            }
        }

        if answered {
            // Ring what the right answer is, so a small one is easy to spot.
            var centre: CGPoint?
            switch target {
            case .country(let t): if verdict?.correct == false { centre = CGPoint(x: t.label[0], y: t.label[1]) }
            case .mountain(let m): centre = CGPoint(x: m.at[0], y: m.at[1])
            case .river: centre = nil
            }
            if let centre {
                let r = 14 * pt
                c.stroke(Path(ellipseIn: CGRect(x: centre.x - r, y: centre.y - r, width: 2 * r, height: 2 * r)), with: .color(green), lineWidth: 2.2 * pt)
            }
        }
        if let tap {
            let r = 4.5 * pt
            let dot = Path(ellipseIn: CGRect(x: tap.x - r, y: tap.y - r, width: 2 * r, height: 2 * r))
            c.fill(dot, with: .color(verdict?.correct == true ? green : red))
            c.stroke(dot, with: .color(.white), lineWidth: 1.2 * pt)
        }
    }
}
