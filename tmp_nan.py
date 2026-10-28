p = 'ios/Tests/LearnedTests.swift'
s = open(p, encoding='utf-8').read()
old = '            XCTAssertFalse(text.joined(separator: " ").contains("nan"), card.id)'
assert old in s
new = '''            let joined = text.joined(separator: " ")
            XCTAssertFalse(joined.contains("NaN") || joined.contains("Optional(") || joined.contains("null"), card.id)'''
open(p, 'w', encoding='utf-8', newline='\r\n').write(s.replace(old, new, 1))
