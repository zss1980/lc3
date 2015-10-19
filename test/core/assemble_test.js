import {describe, it} from 'mocha';
import {expect} from 'chai';

import assemble, * as assembleHelpers from '../../src/core/assemble';

describe('assemble', () => {

    const makeTesters = (fn) => ({
        good: (...args) => (expected) => () =>
            expect(fn.apply(null, args)).to.deep.equal(expected),
        bad: (...args) => (message) => () =>
            expect(() => fn.apply(null, args)).to.throw(message),
    });

    describe("meta-helper handleErrors", () => {
        const inc1 = x => x + 1;
        const bad = x => {
            throw new Error("Bad!");
        };
        const greaterThan = (x, y) => {
            if (x > y) {
                return x;
            } else {
                throw new Error(`Expected ${x} to be greater than ${y}!`);
            }
        };

        const context = {
            line: 42,
        };
        const {handleErrors} = assembleHelpers;

        it("passes arguments through a successful unary function", () =>
            expect(handleErrors(context, inc1)(10)).to.deep.equal(
                { success: true, result: 11 }));

        it("formats an error based on a failed unary function", () =>
            expect(handleErrors(context, bad)(10)).to.deep.equal(
                { success: false, errorMessage: "at line 42: Bad!" }));

        it("passes arguments through a successful binary function", () =>
            expect(handleErrors(context, greaterThan)(4, 2)).to.deep.equal(
                { success: true, result: 4 }));

        it("formats an error based on a failed binary function", () =>
            expect(handleErrors(context, greaterThan)(2, 4)).to.deep.equal({
                success: false,
                errorMessage: "at line 42: Expected 2 to be greater than 4!",
            }));
    });

    describe("helper parseRegister", () => {
        const {good, bad} = makeTesters(assembleHelpers.parseRegister);

        it("works for R0", good("R0")(0));
        it("works for r1", good("r1")(1));
        it("works for R7", good("R7")(7));
        it("fails for R8", bad("R8")());
        it("fails for R-1", bad("R-1")());
        it("fails for just R", bad("R")());
        it("fails for 1R", bad("1R")());
        it("fails for R12", bad("R12")());
    });

    describe("helper parseLiteral", () => {
        const {good, bad} = makeTesters(assembleHelpers.parseLiteral);

        it("parses #0", good("#0")(0));
        it("parses #-1", good("#-1")(-1));
        it("parses #1", good("#1")(1));
        it("parses xF", good("xF")(15));
        it("parses xf", good("xf")(15));
        it("parses xf", good("xf")(15));
        it("fails on xG", bad("xG")());
        it("fails on #--1", bad("#--1")());
        it("fails on START", bad("START")());
        it("fails on x", bad("x")());
    });

    describe("helper tokenize", () => {
        const {good, bad} = makeTesters(assembleHelpers.tokenize);

        it("parses an empty document", good("")([[]]));

        it("parses a single line with just a comment",
            good("; things go here")([[]]));
        it("parses a single line with just a comment and leading whitespace",
            good("  ; things go here")([[]]));

        it("parses a single line with an .ORIG",
            good(".ORIG x3000")([[".ORIG", "x3000"]]));
        it("parses a single line with an .ORIG and a comment",
            good(".ORIG  x3000   ; start here")([[".ORIG", "x3000"]]));
        it("parses a single line with an .ORIG, a comment, and whitespace",
            good("  .ORIG  x3000   ; start here")([[".ORIG", "x3000"]]));

        it("parses a comma-separated ADD instruction",
            good("ADD  R1,  R2 , R3 ")([["ADD", "R1,R2,R3"]]));
        it("parses a terse comma-separated ADD instruction",
            good("ADD R1,R2,R3")([["ADD", "R1,R2,R3"]]));

        it("parses a space-separated ADD instruction " +
                "(will fail to assemble)",
            good("ADD R1 R2 R3")([["ADD", "R1", "R2", "R3"]]));
        it("parses a mixed-space-and-comma-separated ADD instruction " +
                "(will fail to assemble)",
            good("ADD R1,R2 R3")([["ADD", "R1,R2", "R3"]]));

        it("parses two consecutive instruction lines",
            good("ADD R1, R2, R3\nAND R4, R5, #11")([
                ["ADD", "R1,R2,R3"],
                ["AND", "R4,R5,#11"],
            ]));

        it("parses five lines with comments/blanks at lines 1, 3, and 5",
            good("; xxx\nADD R1, R2, R3\n\nAND R4, R5, #-11\n ; the end")([
                [],
                ["ADD", "R1,R2,R3"],
                [],
                ["AND", "R4,R5,#-11"],
                [],
            ]));

        it("parses some assembler directives",
            good(".ORIG x3000\n.FILL #1234\n.BLKW xFF\n.END")([
                [".ORIG", "x3000"],
                [".FILL", "#1234"],
                [".BLKW", "xFF"],
                [".END"],
            ]));

        it("deals with semicolons within comments",
            good(";; comment\nBRnzp STUFF ; comment; really\n.END")([
                [],
                ["BRnzp", "STUFF"],
                [".END"],
            ]));

        it("deals with Windows shenanigans",
            good("JMP R1\nJMP R2\r\nJMP R3\r\n\nJMP R5")([
                ["JMP", "R1"],
                ["JMP", "R2"],
                ["JMP", "R3"],
                [],
                ["JMP", "R5"],
            ]));

        it("treats quoted expressions atomically",
            good('.STRINGZ "A thing" ; comment text')([
                ['.STRINGZ', '"A thing"'],
            ]));

        it("allows escaped quotes in quoted expressions",
            good(String.raw`.STRINGZ "He says \"hi\""`)([
                ['.STRINGZ', String.raw`"He says \"hi\""`],
            ]));
    });

});
