import XCTest
import SwiftTreeSitter
import TreeSitterP

final class TreeSitterPTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_p())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading P grammar")
    }
}
