import Foundation
import UserNotifications

/// A daily local notification ("Quick one?"). It is scheduled on the device and needs no server.
enum Reminders {
    private static let identifier = "detour.daily"

    /// Asks for permission if needed, then schedules the reminder. Returns whether it is scheduled.
    static func requestAndSchedule(hour: Int, minute: Int) async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound])
            guard granted else { return false }
            schedule(hour: hour, minute: minute)
            return true
        } catch {
            return false
        }
    }

    static func schedule(hour: Int, minute: Int) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier])

        let content = UNMutableNotificationContent()
        content.title = "Quick one?"
        content.body = "Five small cards, about a minute. A few things are ready to check if they stuck."
        content.sound = .default

        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
    }

    static func cancel() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
    }
}
