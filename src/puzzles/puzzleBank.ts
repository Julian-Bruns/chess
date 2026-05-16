export type Puzzle = {
  id: string;
  sourceFen: string;
  moves: string[];
  rating: number;
  ratingDeviation: number;
  popularity: number;
  plays: number;
  themes: string[];
  gameUrl: string;
  openingTags: string[];
};

// Curated from the Lichess CC0 puzzle database. The trainer keeps the original
// ratings, tags, popularity, and play counts so selection can favor reliable,
// instructive puzzles without needing a network connection at runtime.
const lichessPuzzleCsv = `
00008,r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24,f2g3 e6e7 b2b1 b3c1 b1c1 h6c1,1810,76,95,9527,crushing hangingPiece long middlegame,https://lichess.org/787zsVup/black#48,
0000D,5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27,d3d6 f8d8 d6d8 f6d8,1491,75,96,36366,advantage endgame short,https://lichess.org/F8M8OS71#53,
0008Q,8/4R3/1p2P3/p4r2/P6p/1P3Pk1/4K3/8 w - - 1 64,e7f7 f5e5 e2f1 e5e6,1385,80,92,765,advantage endgame rookEndgame short,https://lichess.org/MQSyb3KW#127,
0009B,r2qr1k1/b1p2ppp/pp4n1/P1P1p3/4P1n1/B2P2Pb/3NBP1P/RN1QR1K1 b - - 1 16,b6c5 e2g4 h3g4 d1g4,1084,74,88,606,advantage middlegame short,https://lichess.org/4MWQCxQ6/black#32,Kings_Pawn_Game Kings_Pawn_Game_Leonardis_Variation
000Pw,6k1/5p1p/4p3/4q3/3nN3/2Q3P1/PP3P1P/6K1 w - - 2 37,e4d2 d4e2 g1f1 e2c3,1550,75,92,625,crushing endgame fork short,https://lichess.org/au2lCK5o#73,
000Sa,2Q2bk1/5p1p/p5p1/2p3P1/2r1B3/7P/qPQ2P2/2K4R b - - 0 32,c4c2 e4c2 a2a1 c2b1,1568,75,97,1373,advantage endgame short,https://lichess.org/lTTa9lwd/black#64,
000Vc,8/8/4k1p1/2KpP2p/5PP1/8/8/8 w - - 0 53,g4h5 g6h5 f4f5 e6e5 f5f6 e5f6,1574,78,75,113,crushing endgame long pawnEndgame,https://lichess.org/l6AejDMO#105,
000Zo,4r3/1k6/pp3r2/1b2P2p/3R1p2/P1R2P2/1P4PP/6K1 w - - 0 35,e5f6 e8e1 g1f2 e1f1,1376,75,86,651,endgame mate mateIn2 operaMate short,https://lichess.org/n8Ff742v#69,
000aY,r4rk1/pp3ppp/2n1b3/q1pp2B1/8/P1Q2NP1/1PP1PP1P/2KR3R w - - 0 15,g5e7 a5c3 b2c3 c6e7,1414,78,75,527,advantage master middlegame short,https://lichess.org/iihZGl6t#29,Benoni_Defense Benoni_Defense_Benoni-Indian_Defense
000hf,r1bqk2r/pp1nbNp1/2p1p2p/8/2BP4/1PN3P1/P3QP1P/3R1RK1 b kq - 0 19,e8f7 e2e6 f7f8 e6f7,1575,78,92,729,mate mateIn2 middlegame short,https://lichess.org/71ygsFeE/black#38,Horwitz_Defense Horwitz_Defense_Other_variations
000lC,3r3r/pQNk1ppp/1qnb1n2/1B6/8/8/PPP3PP/3R1R1K w - - 5 19,d1d6 d7d6 b7b6 a7b6,1402,77,94,4595,advantage hangingPiece middlegame short,https://lichess.org/vaqz2bx6#37,
000o3,8/2p1k3/6p1/1p1P1p2/1P3P2/3K2Pp/7P/8 b - - 1 43,e7d6 d3d4 g6g5 f4g5,944,78,87,189,crushing endgame pawnEndgame short zugzwang,https://lichess.org/BAY91mF3/black#86,
000qP,8/7R/8/5p2/4bk1P/8/2r2K2/6R1 w - - 7 51,f2f1 f4f3 f1e1 c2c1 e1d2 c1g1,2120,77,93,1309,crushing endgame exposedKing long skewer,https://lichess.org/r4xUR6fC#101,
000rO,3R4/8/K7/pB2b3/1p6/1P2k3/3p4/8 w - - 4 58,a6a5 e5c7 a5b4 c7d8,1110,82,85,73,crushing endgame fork master short,https://lichess.org/tzeeBEc2#115,
00143,r2q1rk1/5ppp/1np5/p1b5/2p1B3/P7/1P3PPP/R1BQ1RK1 b - - 1 17,d8f6 d1h5 h7h6 h5c5,1848,78,91,2916,advantage middlegame short,https://lichess.org/jcuxlI63/black#34,Scotch_Game Scotch_Game_Mieses_Variation
0017R,r2qk2r/pp2ppbp/1n1p2p1/3Pn3/2P5/2NBBP1P/PP3P2/R2QK2R b KQkq - 0 12,e5c4 d3c4 b6c4 d1a4 d8d7 a4c4,1528,77,96,5103,advantage fork long middlegame,https://lichess.org/ol84k0z4/black#24,Alekhine_Defense Alekhine_Defense_Other_variations
001Oo,6k1/4p1bp/6p1/1p1pP3/1PpPp3/2P1P3/Q2B1KPP/3q4 b - - 2 23,d1a4 a2a4 b5a4 b4b5 g8f7 b5b6,2078,78,84,61,crushing endgame long quietMove,https://lichess.org/8IKs77O9/black#46,
001Wz,4r1k1/5ppp/r1p5/p1n1RP2/8/2P2N1P/2P3P1/3R2K1 b - - 0 21,e8e5 d1d8 e5e8 d8e8,1118,82,89,85,backRankMate endgame mate mateIn2 short,https://lichess.org/84RH3LaP/black#42,
001XA,1qr2rk1/pb2bppp/8/8/2p1N3/P1Bn2P1/2Q2PBP/1R3RK1 b - - 3 23,b8c7 b1b7 c7b7 e4f6 e7f6 g2b7,1687,75,91,1350,crushing discoveredAttack long master middlegame sacrifice,https://lichess.org/KZRiN695/black#46,
001aK,6k1/5p2/4p3/P1B5/2P4P/4Pnp1/Rb1rN3/5K2 b - - 1 33,d2e2 f1e2 g3g2 e3e4 f3d4 e2f2,2069,76,94,449,crushing endgame hangingPiece long quietMove,https://lichess.org/Epr0AiEh/black#66,
001h8,2r3k1/2r4p/4p1p1/1p1q1pP1/p1bP1P1Q/P6R/5B2/2R3K1 b - - 5 34,c4e2 h4h7 c7h7 c1c8 g8g7 c8c7,1780,76,88,620,crushing deflection kingsideAttack long middlegame sacrifice,https://lichess.org/IxCahP6X/black#68,
001kG,rnbq3r/1p2bkpp/p4n2/8/2pNP3/2N5/PPP3PP/R1BQ1RK1 b - - 1 11,e7c5 d1h5 f7g8 h5c5,1859,75,93,1012,advantage opening pin short,https://lichess.org/xXAEaVto/black#22,Sicilian_Defense Sicilian_Defense_Najdorf_Variation
001m3,7r/6k1/2b1pp2/8/P1N3p1/5nP1/4RP2/Q4K2 w - - 2 38,e2e6 h8h1 f1e2 h1a1,1459,76,87,278,advantage endgame short skewer,https://lichess.org/LELOz22f#75,
001om,5r1k/pp4pp/5p2/1BbQp1r1/6K1/7P/1PP3P1/3R3R w - - 2 26,g4h4 c5f2 g2g3 f2g3,1018,80,89,226,mate mateIn2 middlegame morphysMate short,https://lichess.org/VWOIWtIh#51,
001uD,6k1/1p3pp1/1p5p/2r1p3/2n5/r3PN2/2RnNPPP/2R3K1 b - - 1 32,f7f6 f3d2 c4d2 c2d2 c5c1 e2c1,1908,76,92,972,advantage long middlegame,https://lichess.org/2qkVLUl6/black#64,
001w5,1rb2rk1/q5P1/4p2p/3p3p/3P1P2/2P5/2QK3P/3R2R1 b - - 0 29,f8f7 c2h7 g8h7 g7g8q,1035,82,85,217,advancedPawn attraction mate mateIn2 middlegame promotion short,https://lichess.org/0e1vxAEn/black#58,
001wR,6nr/pp3p1p/k1p5/8/1QN5/2P1P3/4KPqP/8 b - - 5 26,b7b5 b4a5 a6b7 c4d6 b7b8 a5d8,1179,84,93,2625,endgame long mate mateIn3,https://lichess.org/ruvbd9JW/black#52,
001wr,r4rk1/p3ppbp/Pp1q1np1/3PpbB1/2B5/2N5/1PPQ1PPP/3RR1K1 w - - 4 18,f2f3 d6c5 g1h1 c5c4,970,81,97,2379,advantage fork master masterVsMaster middlegame short,https://lichess.org/KnJ2mojX#35,Pirc_Defense Pirc_Defense_Classical_Variation
001xO,k1r1b3/p1r1nppp/1p1qpn2/2Np4/1P1P4/PQRBPN2/5PPP/2R3K1 w - - 0 19,d3a6 b6c5 a6c8 c5c4,1875,75,91,1377,crushing master masterVsMaster middlegame sacrifice short,https://lichess.org/fNCePFgY#37,Slav_Defense Slav_Defense_Other_variations
001xl,8/4R1k1/p5pp/3B4/5q2/8/5P1P/6K1 b - - 5 40,g7f6 e7f7 f6e5 f7f4,1081,82,94,11781,advantage endgame master masterVsMaster short skewer superGM,https://lichess.org/bEQkfPQD/black#80,
002Ds,8/1pp5/p2p4/P2Pk2p/1PP1p2P/2n1K2P/3N4/8 b - - 0 45,b7b6 b4b5 c3d1 e3e2 a6b5 a5a6,1992,76,90,114,crushing endgame knightEndgame long,https://lichess.org/2SrvOtZN/black#90,
002GQ,5rk1/5ppp/4p3/4N3/8/1Pn5/5PPP/5RK1 w - - 0 28,f1c1 c3e2 g1f1 e2c1,654,81,73,134,crushing endgame fork short,https://lichess.org/2K7g2pDT#55,
002KJ,r3kb1r/ppq2ppp/4pn2/2Ppn3/1P4bP/2P2N2/P3BPP1/RNBQ1RK1 b kq - 2 10,f8e7 f3e5 c7e5 e2g4,1615,78,90,1728,crushing discoveredAttack middlegame short,https://lichess.org/2NpTzh7O/black#20,Caro-Kann_Defense Caro-Kann_Defense_Advance_Variation
002LF,7r/p2q1pk1/1pp3p1/8/6P1/4Q3/PP1R1P1r/5KN1 b - - 0 38,d7g4 e3e5 f7f6 e5c7 g7h6 c7h2,2183,96,91,583,advantage endgame interference long,https://lichess.org/md88dHiL/black#76,
002Mm,rn1qr1k1/ppp3pQ/3p1pP1/3Pp3/2P1P3/8/PP3PP1/R1B1K3 b Q - 2 16,g8f8 h7h8 f8e7 h8g7,947,78,97,227,deflection mate mateIn2 middlegame short,https://lichess.org/wAkPv4uG/black#32,Three_Knights_Opening Three_Knights_Opening_Other_variations
002O7,r3qrk1/2p2pp1/p2bpn1p/2ppNb2/3P1P2/1PP1P1B1/P2N2PP/R2Q1RK1 b - - 0 14,f5g4 e5g4 f6g4 d1g4,961,95,91,355,crushing middlegame short,https://lichess.org/dFEPPiEc/black#28,Queens_Pawn_Game Queens_Pawn_Game_Accelerated_London_System
002Tf,r3kbnr/ppp1qppp/2n5/3pP3/5B2/4PQ2/PPP2PPP/RN2KB1R w KQkq - 1 7,f1b5 e7b4 b1c3 b4b2,1564,75,84,178,advantage fork opening short,https://lichess.org/Zq56PwHK#13,Queens_Pawn_Game Queens_Pawn_Game_Chigorin_Variation
002Ua,r4rk1/pp3ppp/3p1q2/P1P1p3/2B5/2B2n2/2P2P1P/R2Q1RK1 w - - 0 16,g1h1 f6f4 d1f3 f4f3,1553,75,94,8280,crushing kingsideAttack middlegame short,https://lichess.org/06i3eMVp#31,Sicilian_Defense Sicilian_Defense_Lowenthal_Variation
002Uy,8/8/1p6/k7/P1R5/1K5r/8/8 w - - 26 64,c4c3 h3c3 b3c3 a5a4 c3b2 a4b4,1667,75,97,5840,crushing defensiveMove endgame long rookEndgame,https://lichess.org/sLU7YN1A#127,
002VP,8/6p1/2B1bn2/6k1/3B4/6K1/4P3/8 b - - 4 44,e6d5 d4f6 g5f5 c6d5,1469,79,72,142,crushing endgame short,https://lichess.org/7yJGEbUK/black#88,
002bK,8/7p/2b1k3/p2p1pPB/1n1P3P/N1p1P3/4K3/8 b - - 1 42,c6b5 a3b5 c3c2 e2d2,1129,84,93,820,advantage endgame hangingPiece short,https://lichess.org/IFGj8W5s/black#84,
002mG,5r1k/B1p3pp/2Qb1p2/3Pq3/P6P/8/2P3K1/3R1R2 w - - 1 36,g2f2 f8e8 c6e8 e5e8,2385,81,88,201,advantage middlegame quietMove short,https://lichess.org/age2hanq#71,
002p5,r1bqr1k1/pp1nbpp1/2p2n2/6P1/2BP4/P7/1PQNNPP1/R3K2R b KQ - 0 13,f6d5 c2h7 g8f8 h7h8,908,79,84,178,kingsideAttack mate mateIn2 middlegame short,https://lichess.org/meSoQkhU/black#26,French_Defense French_Defense_Exchange_Variation
002rd,r6k/q1pb1p1p/1b3Pr1/p1ppP2Q/3P2p1/4B3/PP2NRPP/3R2K1 b - - 1 25,d7e6 e2f4 c5d4 f4g6 f7g6 h5h6,1795,74,79,128,crushing kingsideAttack long middlegame pin,https://lichess.org/NcD6lul8/black#50,
002uV,r2r2k1/1p2qppp/2n1p3/5n2/p2P4/P2Q1N2/BP3PPP/2R1R1K1 w - - 4 20,d3f5 e6f5 e1e7 c6e7,1562,76,90,80,advantage middlegame short,https://lichess.org/WKH5eIti#39,
00347,8/2p5/8/2pPk2p/8/4K2P/6P1/8 w - - 1 42,e3d3 h5h4 d3c4 e5d6,2264,75,87,123,crushing endgame pawnEndgame quietMove short,https://lichess.org/xFM0YP9S#83,
0039T,1r5r/p3kp2/4p2p/4P3/3R1Pp1/6P1/P1P4P/4K2R w K - 1 25,d4a4 b8b1 e1f2 b1h1 a4a7 e7f8,1072,89,93,824,crushing defensiveMove endgame long rookEndgame skewer,https://lichess.org/BrtVeJlj#49,
003Ec,3r4/p4R2/1pb2Pp1/n1p1Q1kp/8/P2q4/1P4PP/6RK b - - 2 32,d3f5 e5e3 f5f4 h2h4 g5f5 e3h3,2268,77,89,306,crushing long middlegame pin,https://lichess.org/qnd2dxXz/black#64,
003Jb,6k1/3bqr1p/2rpp1pR/p7/Pp1QP3/1B3P2/1PP3P1/2KR4 w - - 6 22,d4a7 e7g5 c1b1 g5h6,993,81,90,392,advantage fork master middlegame short,https://lichess.org/8RvK0idj#43,
003S3,r4k1r/pNqnppb1/6pn/2p3Np/7P/2P2Q2/PP3PP1/R1B1K2R b KQ - 2 15,a8b8 g5e6 f8g8 e6c7,1405,75,95,13979,advantage middlegame pin short,https://lichess.org/Eu6S0GPA/black#30,Modern_Defense Modern_Defense_Other_variations
003Tx,2r5/pR5p/5p1k/4p3/4r3/B4nPP/PP3P2/1K2R3 w - - 0 27,e1e4 f3d2 b1a1 c8c1,1516,88,83,756,backRankMate endgame fork mate mateIn2 short,https://lichess.org/A7j9VEC0#53,
003UW,8/6pk/7p/2p5/2qp4/5PP1/P3QK1P/8 b - - 1 40,c4d5 e2e4 d5e4 f3e4,1476,75,93,975,advantage endgame queenEndgame short,https://lichess.org/cXMga3rb/black#80,
003aS,8/8/5k1p/6p1/1R4PP/1p2KP2/8/1r6 w - - 0 43,h4h5 b3b2 b4b6 f6e5 f3f4 g5f4,1923,76,93,230,advancedPawn crushing defensiveMove endgame long rookEndgame,https://lichess.org/I7ZktFeR#85,
003eP,8/r1b1q2k/2p3p1/2Pp4/1P2p1n1/2B1P3/NQ6/2K4R b - - 1 36,h7g8 h1h8 g8f7 h8h7 f7e8 h7e7,1156,79,88,1756,crushing exposedKing long middlegame skewer,https://lichess.org/n9vCFmKh/black#72,
003jH,rn3rk1/p5pp/3N4/4np1q/5Q2/1P3K2/PB1P2P1/2R4R w - - 0 25,f3f2 e5d3 f2e3 d3f4 h1h5 f4h5,1065,79,89,319,crushing fork long middlegame,https://lichess.org/3CQGofXT#49,
003jb,r3kb1r/p4ppp/b1p1p3/3q4/3Q4/4BN2/PPP2PPP/R3K2R b KQkq - 0 11,c6c5 d4a4 a6b5 a4b5,1046,77,95,2618,crushing fork master middlegame short,https://lichess.org/960EzUS0/black#22,French_Defense French_Defense_Classical_Variation
003jv,1R6/1p2k2p/p2n2p1/4K3/8/6P1/P6P/8 w - - 10 37,b8h8 d6f7 e5e4 f7h8,1007,84,89,340,crushing endgame fork short,https://lichess.org/n0UvwK36#73,
003mh,r4k1r/1pp2p2/p2p3p/3N4/3P2q1/8/PPP5/1K2Q1NR b - - 1 23,a8e8 e1e8 f8e8 d5f6 e8e7 f6g4,1338,76,86,452,advantage attraction fork long middlegame sacrifice,https://lichess.org/HSa4keKZ/black#46,
003o0,r1bqk2r/pp1nbppp/3p4/1B1p4/3P1B2/8/PPP2PPP/R2QK1NR w KQkq - 2 9,g1f3 d8a5 d1d2 a5b5,1003,83,90,678,advantage fork master opening short,https://lichess.org/Ae0t9V1Z#17,Czech_Defense Czech_Defense_Other_variations
003r5,r2qr1k1/ppp2ppp/4b3/3P4/1nP2Q2/2N2N1P/PP3KP1/R4R2 w - - 1 15,d5e6 b4d3 f2g1 d3f4,1107,79,88,860,crushing fork middlegame short,https://lichess.org/JPN97v7j#29,Kings_Gambit_Accepted Kings_Gambit_Accepted_Abbazia_Defense
003wQ,2r2rk1/6pp/3Q1q2/8/3N1B2/6P1/PP1K3P/R4b2 w - - 0 24,a1f1 f6d6 f4d6 f8f1,1814,79,92,2040,advantage discoveredAttack middlegame pin short,https://lichess.org/W3wvnzlo#47,
0040n,r7/p2k1pp1/p1p1pn2/3p4/3P4/P3PQp1/1PP2P1q/2K4R w - - 0 20,h1h2 g3h2 f3h3 f6g4,1296,75,98,1842,advancedPawn advantage endgame short,https://lichess.org/WIUWcrdG#39,
0047P,8/1N3k2/6p1/8/2P3P1/pr6/R5K1/8 w - - 1 56,g2f1 b3b1 f1e2 b1b2 e2d1 b2a2,1766,75,86,94,crushing endgame exposedKing fork long master,https://lichess.org/Gb33KZKC#111,
0048h,4r3/p5k1/2p2R1p/2Pp4/1P1pr1P1/P6P/8/3R3K w - - 1 35,f6c6 e4e1 d1e1 e8e1 h1g2 d4d3,1164,76,98,1927,crushing endgame exposedKing long rookEndgame,https://lichess.org/dq15P00L#69,
004Ax,8/8/4R1kp/p7/5rPK/8/7P/8 b - - 2 42,g6f7 e6h6 f4f6 h6h7 f7g6 h7a7,2058,77,92,644,crushing endgame exposedKing long rookEndgame,https://lichess.org/x2mMwVJD/black#84,
004BW,r1bk2r1/ppq2pQp/3bpn2/1BpnN3/5P2/1P6/PBPP2PP/RN2K2R w KQ - 3 13,e5f7 d8e7 g7g8 f6g8,1432,77,91,1783,advantage master middlegame short,https://lichess.org/EXlG6TZs#25,Sicilian_Defense Sicilian_Defense_Modern_Variations
004LZ,8/7R/5p2/p7/7P/2p5/3k2r1/1K2N3 w - - 3 48,e1g2 c3c2 b1a2 c2c1q h7d7 d2e2,1187,77,93,2047,advancedPawn crushing defensiveMove deflection endgame long promotion,https://lichess.org/drahwNdj#95,
004Lu,8/p1p4p/4Pk2/2PP1p1P/1r3r2/5B2/P3RK2/8 b - - 3 38,f6e7 d5d6 c7d6 c5d6 e7d6 e6e7,1269,75,99,1298,advancedPawn advantage endgame exposedKing long master,https://lichess.org/WMeZuWza/black#76,
004RF,5rk1/5ppp/1p6/1qp2P1Q/3p3P/6R1/6PK/8 b - - 0 30,c5c4 g3g7 g8g7 f5f6 g7f6 h5b5,1746,78,82,54,attraction crushing discoveredAttack endgame long sacrifice,https://lichess.org/2UeWcE4h/black#60,
004Ud,r1bqk2r/p3Bppp/3p4/1ppn4/4P3/4Q3/PPP2PPP/2KR1B1R b kq - 0 11,d5e7 f1b5 c8d7 d1d6 d7b5 d6d8,1678,77,94,3252,advantage interference long middlegame,https://lichess.org/pJ7nXTvE/black#22,Three_Knights_Opening Three_Knights_Opening_Other_variations
004d8,8/4kr2/R2p4/1p1Pp1p1/5p2/3K1P2/PPP5/8 b - - 0 39,g5g4 a6a7 e7f6 a7f7 f6f7 f3g4,1608,78,87,104,crushing endgame long rookEndgame,https://lichess.org/FrR3BHbW/black#78,
004mT,5Q2/8/1b1kp1p1/5p2/3p4/5qPK/7P/8 b - - 1 51,d6c6 f8a8 c6d6 a8f3,1392,74,98,8532,advantage endgame short skewer,https://lichess.org/Jqhi4ozb/black#102,
004nd,3q2k1/2r5/pp3p1Q/2b1n3/P3N3/2P5/1P4PP/R6K b - - 0 24,c7d7 e4f6 d8f6 h6f6,898,75,83,209,crushing fork middlegame short,https://lichess.org/IajkZZBp/black#48,
004sg,6k1/p3b2p/1p1pP3/2p3P1/1Pnp3B/P6P/3Q3K/8 w - - 0 38,b4c5 c4d2 c5c6 d6d5 g5g6 e7d6,2395,85,90,1368,advantage clearance endgame hangingPiece long quietMove,https://lichess.org/pSRIvt7K#75,
004u0,6k1/ppq3pp/2p1rp2/4r3/4p1Q1/P5RP/1P3PP1/3R2K1 b - - 3 34,e6e8 d1d7 c7d7 g4d7,1326,77,91,1033,advantage endgame short,https://lichess.org/3gEqoQeQ/black#68,
0050w,5rk1/1p2p1rp/p2p4/2pPb2R/2P1P3/1P1BKP1R/8/8 b - - 4 30,g7g3 h3g3 e5g3 h5g5 g8f7 g5g3,1095,85,91,1512,crushing endgame fork long,https://lichess.org/QD8pUcTR/black#60,
0054a,r1b2rk1/ppq2ppp/8/4b2Q/4R3/3B4/PP3PPP/R1B3K1 b - - 1 15,g7g6 h5e5 c7e5 e4e5,1455,75,97,6736,advantage middlegame short,https://lichess.org/kZlE1pvD/black#30,Queens_Pawn_Game Queens_Pawn_Game_Colle_System
0055Y,r1b2rk1/p3pp2/2B4b/2Qpq3/3N2pp/4P3/2P2PPP/1R2K2R b K - 1 23,h6e3 f2e3 e5e3 e1d1,2055,76,80,149,advantage defensiveMove middlegame short,https://lichess.org/7Jpwzowt/black#46,
005Bm,4rk2/p1q5/1p3Q1b/8/1p5N/2P1p3/P3P3/2K5 b - - 0 43,c7f7 h4g6 f8g8 f6h8,1204,76,97,5655,endgame mate mateIn2 pin short,https://lichess.org/KKslCMev/black#86,
005HG,r2q1rk1/p1p2pp1/3bbn1p/4N3/2Q5/1P4P1/PB1PPP1P/RN2K2R w KQ - 1 12,c4c2 d6e5 b2e5 d8d5 f2f3 d5e5,1755,75,88,695,advantage clearance fork long opening,https://lichess.org/JTymzeq9#23,English_Opening English_Opening_Kings_English_Variation
005N7,r6k/2q3pp/8/2p1n3/R1Qp4/7P/2PB1PP1/6K1 b - - 0 32,e5c4 a4a8 c7b8 a8b8,654,101,95,1914,backRankMate endgame hangingPiece mate mateIn2 short,https://lichess.org/jxZhmGhg/black#64,
005YM,5k2/p4pp1/1qn3r1/3pP2p/5P2/1NPQ4/Pr3RPP/R5K1 w - - 5 24,b3d4 b2f2 g1f2 c6d4 d3d4 b6b2,2429,104,90,261,advantage long middlegame,https://lichess.org/fDmK2ipV#47,
005nD,3rk2r/2qn1pp1/p1Q1R3/3n3p/8/8/PP4PP/5R1K b k - 0 23,f7e6 c6e6 d5e7 e6f7,1142,76,96,1316,fork mate mateIn2 middlegame short,https://lichess.org/hlgaj6lV/black#46,
005wy,1r6/pp2kpp1/2n1p1n1/3p2PQ/5P2/2PqP3/PP1N4/2KR3R w - - 3 27,h5h7 c6b4 c3b4 b8c8 d2c4 c8c4,1825,74,94,6490,long mate mateIn3 middlegame queensideAttack sacrifice,https://lichess.org/mBQMheB4#53,
0061g,6k1/pp3pp1/2p1q1Pp/3b4/8/6Q1/PB3Pp1/3RrNK1 b - - 2 27,e1d1 g3b8 e6e8 b8e8,801,93,73,269,endgame mate mateIn2 short,https://lichess.org/dJ3xEKJK/black#54,
0068B,r1q3k1/4bppp/pp2pn2/4B3/8/2N2Q2/PPPR1PPP/6K1 b - - 0 18,f6d7 d2d7 c8d7 f3a8,1401,78,92,6133,crushing deflection middlegame short,https://lichess.org/LNdzAgWP/black#36,Sicilian_Defense Sicilian_Defense_Katalimov_Variation
006HV,1r6/5k2/2p1pNp1/p5Pp/1pQ1P2P/2P4R/KP3P2/3q4 w - - 4 31,c4c6 b4b3 a2a3 d1a1,1163,87,93,1014,endgame mate mateIn2 short,https://lichess.org/ibb2c72C#61,
006OI,8/p7/5k2/P5R1/6KP/8/8/5r2 w - - 5 53,g5g8 f1g1 g4f4 g1g8,843,97,76,263,crushing endgame rookEndgame short skewer,https://lichess.org/6AH1H5wg#105,
006RM,1k1r3r/2q5/pp1n2p1/8/1Q6/3R2P1/PPP2P1P/3R2K1 b - - 4 29,c7c5 b4c5 b6c5 d3d6 d8d6 d1d6,1448,78,82,1130,crushing long middlegame,https://lichess.org/ceS0QvtT/black#58,
006XF,r5kr/pp1qb1p1/2p4p/3pPb1Q/3P4/2P1B3/PP4PP/R4RK1 b - - 1 17,f5e4 h5f7 g8h7 f1f6 e7f6 f7d7,2369,89,90,1927,advantage long middlegame pin,https://lichess.org/Ynra1LLE/black#34,Russian_Game Russian_Game_Italian_Variation
006cZ,3r1rk1/1p4p1/p1p3Qp/2q5/8/3n1N1P/PP1R2P1/5R1K b - - 7 28,g8h8 d2d3 d8d3 g6d3,1376,75,88,650,advantage master masterVsMaster middlegame short,https://lichess.org/qrbDEp56/black#56,
006fF,r1b4r/pp1k2pp/2nb2q1/1B1p2B1/3p3Q/8/PPP2PPP/3RR1K1 b - - 5 17,h7h6 h4g4 d7c7 g5d8 h8d8 g4g6,1858,78,96,7194,advantage discoveredAttack exposedKing long middlegame,https://lichess.org/mAf9SSin/black#34,Italian_Game Italian_Game_Two_Knights_Defense
006i7,r4rk1/3nqpp1/2p1bn1p/3pN3/1p1P4/2NQP2P/1PB2PP1/R4RK1 w - - 0 18,e5c6 e7d6 a1a8 f8a8 c6b4 d6b4,1769,87,82,62,advantage long middlegame,https://lichess.org/77CYKPKY#35,Queens_Gambit_Declined Queens_Gambit_Declined_Other_variations
006om,1r3k2/5p1p/2p1pp2/P2n4/2r1N3/P4PK1/2R2P1P/2R5 b - - 9 29,c4a4 e4c5 a4a5 c5d7 f8g7 d7b8,1860,74,95,8393,crushing endgame fork long master,https://lichess.org/BMIgw1OR/black#58,
006pe,r4r2/2q1NN2/4bQpk/2n4p/pp5P/8/1PP2PP1/2KR3R b - - 0 28,e6f7 e7f5 h6h7 f6g7,1585,77,96,4638,master mate mateIn2 middlegame pin short,https://lichess.org/gkSEAS27/black#56,
006wz,2r5/4ppkp/5bp1/1p6/1P6/P3B3/2r2PPP/1R1R2K1 b - - 2 22,f6b2 b1b2 c2b2 e3d4 f7f6 d4b2,1428,75,80,542,attraction crushing endgame fork long sacrifice,https://lichess.org/qT0W6o27/black#44,
006yP,6R1/8/Kpk1p3/1p1pP3/6P1/PPP1r3/8/8 b - - 3 40,e3c3 g8c8 c6d7 c8c3,819,89,80,152,crushing endgame master rookEndgame short skewer,https://lichess.org/vf9MOLH1/black#80,
0071K,3N1r2/6R1/kp6/p2pPp1Q/2pP2P1/2q5/2P5/2K5 w - - 0 38,g7a7 a6a7 h5h7 a7a6,1109,86,94,466,crushing defensiveMove endgame hangingPiece short,https://lichess.org/gY0ZkxR4#75,
0072T,3q1nk1/1bN2rpp/pp1P4/1N6/4n2b/8/PPP2PPP/R1BQ1RK1 w - - 1 16,b5d4 h4f2 f1f2 e4f2,2252,79,87,512,advantage kingsideAttack master middlegame short,https://lichess.org/aqhibPRF#31,Philidor_Defense Philidor_Defense_Lion_Variation
00734,rn3bk1/2rqp2p/2p3p1/3p1p2/3P1P1B/pP1BP3/P1Q2PRP/1KR5 b - - 0 26,b8a6 d3f5 e7e6 f5g6,1692,74,89,127,crushing middlegame pin short,https://lichess.org/jM0Jnw0u/black#52,
00761,3r2k1/1b3pbR/p2P2P1/3p2N1/2p5/2P2N2/PP6/2K5 b - - 0 28,f7g6 h7g7 g8g7 g5e6 g7g8 e6d8,1420,77,94,21938,attraction crushing endgame exposedKing fork long sacrifice,https://lichess.org/vu70Maig/black#56,
0078T,rk5r/1b3R2/pp2p2q/4P2p/B2p3B/4R2P/PP4P1/5Q1K b - - 0 27,d4e3 f7b7 b8b7 f1f7 b7b8 h4e7,2248,80,81,87,attraction crushing defensiveMove exposedKing long middlegame queensideAttack sacrifice,https://lichess.org/mXf4gFYU/black#54,
00798,6K1/4k3/4P3/6pp/6rP/4R1P1/8/8 w - - 0 60,g8g7 g5h4 g7h6 h4g3,1924,76,88,535,crushing discoveredAttack endgame rookEndgame short,https://lichess.org/4DOjQjiM#119,
007Rn,4r1k1/p4p1p/1p6/6q1/3P2n1/P4Q2/1P1B2P1/7K w - - 0 34,d2g5 e8e1 f3f1 e1f1,990,83,75,77,endgame mate mateIn2 short,https://lichess.org/L9kH7FqT#67,
007XE,2kr3r/p1p1bpp1/2p2n1p/8/8/1P6/P1P1RPPP/RNB3K1 w - - 1 16,e2e7 d8d1 e7e1 d1e1,630,93,79,80,backRankMate fork mate mateIn2 middlegame short,https://lichess.org/f4f7UwiT#31,Kings_Pawn_Game Kings_Pawn_Game_Leonardis_Variation
007eS,6k1/p4p2/1p5p/4r3/P3B3/1P3P2/2PK2PP/8 w - - 0 29,d2e3 f7f5 g2g4 f5e4,1306,74,95,13396,advantage endgame short,https://lichess.org/8qs8bafy#57,
007en,rn3rk1/4pp1p/3p2pB/2q4P/3bP1b1/Pp2Q3/1P2B3/1K1R2NR w - - 0 20,e3d4 c5c2 b1a1 a8a3 b2a3 c2a2,1807,79,96,3302,long mate mateIn3 middlegame queensideAttack sacrifice,https://lichess.org/jzE2yKAk#39,
007gO,2r3rk/5p2/4p2p/4q3/1Q6/8/1P3PPP/R4RK1 w - - 0 31,a1c1 e5g5 g2g3 c8c1,2197,85,76,48,crushing endgame short,https://lichess.org/id1brvZc#61,
007ku,r1bq3Q/1np2kp1/p5B1/1p1Pp3/1Pn2BP1/2b2P2/P3K3/R4N2 b - - 5 35,f7g6 h8h5 g6f6 f4g5,1663,75,89,965,mate mateIn2 middlegame short,https://lichess.org/QveLbBjG/black#70,
007mr,5k2/p2r3p/1p4pP/3r1q2/3Rp3/2P5/PP3PQ1/K3R3 w - - 0 33,d4e4 d5d1 e1d1 d7d1,733,81,100,143,backRankMate endgame mate mateIn2 short,https://lichess.org/J12UnEgz#65,
007tv,r3k1nr/1pp2ppp/1pnp2q1/4p1B1/2B1P3/3P1Q1P/PPP2PP1/R4RK1 b kq - 0 11,g6g5 f3f7 e8d8 f7f8 d8d7 f8a8,1128,80,90,1308,advantage attackingF2F7 long middlegame skewer,https://lichess.org/ky7qZNjk/black#22,Italian_Game Italian_Game_Giuoco_Pianissimo
0088O,7Q/2p5/1p2prp1/p4k1p/P4p1P/8/6RK/3q4 b - - 2 37,d1a4 g2g5 f5e4 h8f6,1133,80,85,444,crushing deflection endgame short,https://lichess.org/GmH1DPx6/black#74,
008D5,r1bqk2r/pp3ppp/4p2n/3pP3/1b1P1P2/2N5/PP4PP/R1BQKB1R b KQkq - 2 9,h6f5 d1a4 c8d7 a4b4,1408,75,85,1187,advantage fork master opening short,https://lichess.org/jIGC2FuP/black#18,French_Defense French_Defense_La_Bourdonnais_Variation
008LT,r4rk1/6p1/b3p1nN/p1pp4/1p3P1q/3P1Q1B/PPP2PK1/R6R b - - 0 26,g8h8 h6f7 f8f7 h3e6,2185,80,90,1352,crushing kingsideAttack middlegame pin sacrifice short,https://lichess.org/vnxisKeU/black#52,
008P4,8/4k3/1p1p4/rP2p1p1/P2nP1P1/3BK3/8/R7 w - - 0 35,e3d2 d4b3 d2c3 b3a1,713,98,95,1675,crushing endgame fork short,https://lichess.org/3GoHPRp3#69,
008Sk,8/6pp/3Bp2k/p2pP2P/P2bp1PK/8/r7/5R2 b - - 2 37,d4f2 f1f2 g7g5 h4g3 a2f2 g3f2,2191,78,94,14484,crushing endgame long,https://lichess.org/rah6MiKa/black#74,
008Y3,r5k1/1p1rqpp1/p3pnp1/2PN4/8/1Q5P/PP3PP1/3RR1K1 b - - 0 24,e7c5 d5f6 g7f6 d1d7,1055,88,93,664,advantage discoveredAttack kingsideAttack master middlegame short,https://lichess.org/jAILX5BH/black#48,
008lc,7k/pb1qn2n/1p2R2Q/2p2p2/2Pp4/3B4/PP3PrP/4RK2 b - - 1 27,g2g7 h6g7 h8g7 e6e7 d7e7 e1e7,1965,77,93,2208,attraction crushing exposedKing fork long middlegame,https://lichess.org/UdZXrVA5/black#54,
008nF,2rq1rk1/7p/1n4pb/1R2p3/pPpP1P2/P1B5/3NQ1PP/2R3K1 w - - 0 31,e2e5 f8e8 e5e8 d8e8,2100,83,90,818,crushing master middlegame short trappedPiece,https://lichess.org/tYO5rrIU#61,
008oX,4r1k1/2R3pp/2p4q/1p1p4/3P4/P7/1PP2R2/1K1N4 b - - 3 32,e8e1 c7c8 e1e8 c8e8,976,77,71,222,endgame mate mateIn2 short,https://lichess.org/APGKH8YH/black#64,
`;

export const puzzleBank: Puzzle[] = lichessPuzzleCsv
  .trim()
  .split('\n')
  .map((line) => parsePuzzleLine(line));

function parsePuzzleLine(line: string): Puzzle {
  const [id, sourceFen, moves, rating, ratingDeviation, popularity, plays, themes, gameUrl, openingTags = ''] = line.split(',');

  return {
    id,
    sourceFen,
    moves: moves.split(' '),
    rating: Number(rating),
    ratingDeviation: Number(ratingDeviation),
    popularity: Number(popularity),
    plays: Number(plays),
    themes: themes.split(' ').filter(Boolean),
    gameUrl,
    openingTags: openingTags.split(' ').filter(Boolean)
  };
}
