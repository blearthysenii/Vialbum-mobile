import Foundation

@MainActor
final class LaunchAnimationCoordinator {
  private var completion: (() -> Void)?

  func prepare(completion: @escaping () -> Void) {
    self.completion = completion
  }

  func complete() {
    completion?()
    completion = nil
  }
}
