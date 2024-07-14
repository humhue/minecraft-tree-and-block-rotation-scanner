
const File = Java.type("java.io.File");
const FileWriter = Java.type("java.io.FileWriter");

const cmds = ["start", "end"];

const rotationBlocks = ["lime_glazed_terracotta", "yellow_glazed_terracotta"];
const logBlocks = ["oak_log", "birch_log"];
const leafBlocks = ["_leaves"];

let startPos = null;

// Only used for tex rots. Change this to true if the orientation of your recreation
// is not the same as the one of the area you're trying to recreate.
const bruteforceDirections = false;

// Only used when scanning tree data. Change this to true if air == absent leaf.
// You might want to set this to true when scanning tree data from an actual world rather than from a recreation.
// false by default because I suggest you use glass blocks in your recreation instead.
const isAirAbsentLeaf = false;

const numberOfDirections = bruteforceDirections ? 4 : 1;
const directionMaps = generateDirections(numberOfDirections);

// Versions explicitly supported by andrew's treecracker
const supportedVersions = ["1.6.4", "1.8.9", "1.12.2", "1.14.4", "1.15.2", "1.16.1", "1.16.4"];


let versionEnum = {}; // {"1.6.4": "v1_6_4", ...}
for (let i = 0; i < supportedVersions.length; i++) {
    const version = supportedVersions[i].replace(/\./g, "_");
    versionEnum[supportedVersions[i]] = `v${version}`;
}


// for y's -2,-1
//       ＿＿＿＿＿＿＿＿＿＿
//      | ❓ 🟢 🟢 🟢 ❓ |
//      | 🟢 🟢 🟢 🟢 🟢 |
//      | 🟢 🟢 🪵 🟢 🟢 |
//      | 🟢 🟢 🟢 🟢 🟢 |
//      | ❓ 🟢 🟢 🟢 ❓ |
//      ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
// x is east, z is south
// offsets for the blocks in a canopy
const ys = [-2, -1, 0, 1]; // 0 is the last log, -2 is the first log surrounded by leaves, etc
const vs = [-2, -2, -1, -1]; // x's and z's
const maxY = Math.max(...ys);

const randomOffsets = [];    // random leaves, 12 elements
const nonrandomOffsets = []; // guaranteed leaves and logs, 52 elements
// NW, SW, NE, SE
for (let i = 0; i < ys.length; i++) {
    const y = ys[i];
    const extremes = [minV, maxV] = [vs[i], Math.abs(vs[i])];
    for (let x = minV; x <= maxV; x++) {
        for (let z = minV; z <= maxV; z++) {
            if (extremes.includes(x) && extremes.includes(z)) {
                // the extremes of the last layer are blocks of air rather than leaves so we ignore them
                if (y !== maxY) {
                    randomOffsets.push([x, y, z]);
                }
            } else {
                nonrandomOffsets.push([x, y, z]);
            }
        }
    }
}
const allOffsets = randomOffsets.concat(nonrandomOffsets);


function endsWithAny(string, suffixes) {
    return suffixes.some((suffix) => string.endsWith(suffix));
}

function maxMin(a, b) {
    return a > b ? [a, b] : [b, a];
}

// The third parameter might look weird, but this function must be called using an origin block (reference block)
function clone(minPos, maxPos, diffPos) { // begin, end, destination - begin
    Chat.say(`/clone ${minPos[0]} ${minPos[1]} ${minPos[2]}` +
             ` ${maxPos[0]} ${maxPos[1]} ${maxPos[2]}` +
             ` ${minPos[0] + diffPos[0]} ${minPos[1] + diffPos[1]} ${minPos[2] + diffPos[2]}`);
}

function generateDirections(max) {
    const maps = []; // [{"north": 0, "east": 1, "south": 2, west: 3}, {"north": 1, "east": 2, "south": 3, west: 0}, ...]
    //                   facing north,                                 facing east, ...
    const directions = ["north", "east", "south", "west"];

    for (let i = 0; i < directions.length; i++) {
        if (i >= max) break;
        const map = {};
        for (let j = 0; j < directions.length; j++) {
            map[directions[j]] = (i + j) % 4;
        }
        maps.push(map);
    }
    return maps;
}

function getRotationCode(blocks) {
    let out = "";
    const [ox, oy, oz] = [blocks[0].getX(), blocks[0].getY(), blocks[0].getZ()];
    for (let i = 0; i < directionMaps.length; i++) {
        const directionMap = directionMaps[i];
        for (let j = 0; j < blocks.length; j++) {
            const block = blocks[j];
            const [x, y, z, rot] = [
                block.getX(), block.getY(), block.getZ(),
                directionMap[block.getBlockState()["facing"]]
            ];
            out += `formation.add(new RotationInfo(${x - ox}, ${y - oy}, ${z - oz}, ${rot}, false)); // x: ${x}, y: ${y}, z: ${z}\n`;
        }
        if (i !== directionMaps.length - 1) {
            const facing = Object.keys(directionMap).find(key => directionMap[key] == 0);
            out += `\nOR FACING ${facing}\n\n`;
        }
    }
    return out;
}

// get population chunk coordinates
function pc(version, a) {
    if (supportedVersions.indexOf(version) <= supportedVersions.indexOf("1.12.2")) {
        return (a - 8) >> 4;
    } else {
        return a >> 4;
    }
}

function getTreePatterns(trees) {
    const s = []; // [["464,70,292", "464,71,292", ... up to 12 random leaf positions], ...]
    // s is a list of random leaf positions for each tree
    const g = {}; // {"464,70,292": [1,2,1], ...}
    // g keeps track of all the states a position holds, in the example data:
    // two trees report the block as being both present & random
    // while another tree reports it as non-random (always present)
    // so we cannot use it with the treecracker (it will be "?")
    for (const tree of trees) {
        // push every random leaf position into s
        s.push(tree.randomLeaves.map((leaf) => leaf.position));
        for (const leaf of tree.leaves) {
            // create the array once
            if (!g.hasOwnProperty(leaf.position)) {
                g[leaf.position] = [];
            }
            // push the state into the array
            g[leaf.position].push(leaf.state);
        }
    }

    for (const position in g) {
        if (g.hasOwnProperty(position)) {
            const states = g[position];
            // if even just one tree reports the position as being always present
            // it means it's unknown
            if (states.includes("2")) {
                g[position] = "?";
            // if it's absent, I guess it's absent
            } else if (states.includes("0")) {
                g[position] = "0";
            // if there's only one state === "1"
            } else if (states.filter((state) => state === "1").length === 1) {
                g[position] = "1";
            // if (it's unknown) or (there are multiple states === "1"):
            // we know nothing about the actual leaf generation state
            } else {
                g[position] = "?";
            }
        }
    }

    for (let i = 0; i < trees.length; i++) {
        const treeRandomLeafPositions = s[i];
        // get the state of each random leaf position of the tree using g, and create a single string
        // like: "1001??11011?"
        const pattern = treeRandomLeafPositions.map((position) => g[position]).join("");
        // iterate over the string
        for (let j = 0; j < pattern.length; j++) {
            // increment numberOfBits for every known leaf state
            if (pattern[j] !== "?") {
                trees[i]["numberOfBits"] += 1;
            }
        }
        // add the "leafPattern" attribute to each tree object inside trees
        trees[i]["leafPattern"] = pattern;
    }
    return trees;
}

function getTreeCode(trees, version) {
    let chunks = new Map();
    for (let i = 0; i < trees.length; i++) {
        const tree = trees[i];
        let chunkX = pc(version, tree.lastLog.getX());
        let chunkZ = pc(version, tree.lastLog.getZ());
        const chunkString = JSON.stringify([chunkX, chunkZ]);
        if (chunks.has(chunkString)) {
            chunks.get(chunkString).push(tree);
        } else {
            chunks.set(chunkString, [tree]);
        }
    }

    let out = "";
    for (const chunkString of chunks.keys()) {
        const [chunkX, chunkZ] = JSON.parse(chunkString);
        const treesInChunk = chunks.get(chunkString);

        const totalBits = treesInChunk.reduce(
            (acc, tree) => acc + tree.numberOfBits,
            0,
        );

        out += `// chunkX: ${chunkX}, chunkZ: ${chunkZ}\n`;
        out += `return TreeChunkBuilder(Version::${versionEnum[version]}, Biome::Forest) // total bits: ${totalBits}\n`;

        // sort trees by bityield
        treesInChunk.sort((a, b) => b.numberOfBits - a.numberOfBits);

        for (let i = 0; i < treesInChunk.length; i++) {
            const tree = treesInChunk[i];
            const lastLog = tree.lastLog;
            const treeType = lastLog.getId().replace(/^minecraft:(\w+)_log$/, "$1");
            const s = tree.leafPattern;
            const leafString = `"${s.slice(0, 4)}""${s.slice(4, 8)}""${s.slice(8, 12)}"`; // this improves readability
            out += `    .tree_${treeType}(${lastLog.getX()}, ${lastLog.getZ()}, ` +
                `IntRange(${tree.height}), ${leafString}) // bits: ${tree.numberOfBits}\n`;
            
        }
        out += "    .build();\n\n";
    }
    return out;
}

function reg(s, version) {
    if (!s in cmds) return;
    if (version != "" && !versionEnum.hasOwnProperty(version)) {
        Chat.log(`reg: you need to choose a version among: ${supportedVersions.join(", ")}`);
        return;
    }
    if (s == "start") {
        const p = Player.getPlayer().getPos();
        // always get the block pos
        startPos = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)];
        Chat.log("reg: start done");
    } else { // we're sure that s == "end"
        if (startPos == null) {
            Chat.log("reg: you need to set a start pos first");
            return;
        }
        const p = Player.getPlayer().getPos();
        // always get the block pos
        const endPos = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)];

        const [maxX, minX] = maxMin(startPos[0], endPos[0]);
        const [maxY, minY] = maxMin(startPos[1], endPos[1]);
        const [maxZ, minZ] = maxMin(startPos[2], endPos[2]);
        const minPos = [minX, minY, minZ];
        const maxPos = [maxX, maxY, maxZ];

        let blocksWithFakeRotation = [];
        let count = 0;
        let count2 = 0;

        var trees = [];
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                for (let y = minY; y <= maxY; y++) {
                    count++;

                    const block = World.getBlock(x, y, z);

                    if (endsWithAny(block.getId(), rotationBlocks)) {
                        blocksWithFakeRotation.push(block);
                        ++count2;
                    }

                    // try to detect trees
                    // dirt -> log
                    if (block.getId() == "minecraft:dirt") {
                        let lastLog;
                        let lastBlock;
                        let height = 0;
                        
                        while (endsWithAny(
                            (lastBlock = World.getBlock(x, y + height + 1, z)).getId(),
                            logBlocks,
                        )) {
                            lastLog = lastBlock;
                            height++;
                        }
                        if (height >= 3) {
                            let numberOfBits = 8;
                            if (height == 3) {
                                height = -1; // height is actually undefined
                            } else {
                                numberOfBits += 1;
                            }

                            let randomLeaves = [];
                            let leaves = []; 
                            
                            // random offsets only
                            for (let i = 0; i < randomOffsets.length; i++) {
                                const offset = randomOffsets[i];
                                const [leafX, leafY, leafZ] = [
                                    lastLog.getX() + offset[0],
                                    lastLog.getY() + offset[1],
                                    lastLog.getZ() + offset[2],
                                ];
                                
                                // a leaf state is unknown by default
                                let state = "?";
                                const leaf = World.getBlock(leafX, leafY, leafZ);
                                if ((isAir = (
                                        (leaf.getBlockStateHelper().isAir() && isAirAbsentLeaf) ||
                                        leaf.getId() == "minecraft:glass")
                                    ) ||
                                    endsWithAny(leaf.getId(), leafBlocks)) {
                                    state = isAir ? "0" : "1";
                                }
                                let leafData = {
                                    "position": `${leafX},${leafY},${leafZ}`,
                                    "state": state
                                };
                                randomLeaves.push(leafData);
                                leaves.push(leafData);
                            }

                            for (let i = 0; i < nonrandomOffsets.length; i++) {
                                const offset = nonrandomOffsets[i];
                                const [leafX, leafY, leafZ] = [
                                    lastLog.getX() + offset[0],
                                    lastLog.getY() + offset[1],
                                    lastLog.getZ() + offset[2],
                                ];

                                let state = "2"; // guaranteed block
                                let leafData = {
                                    "position": `${leafX},${leafY},${leafZ}`,
                                    "state": state
                                };
                                leaves.push(leafData);
                            }

                            const treeData = {
                                "lastLog": lastLog, "height": height,
                                "numberOfBits": numberOfBits,
                                "randomLeaves": randomLeaves, "leaves": leaves,
                            };
                            trees.push(treeData);
                        }
                    }
                }
            }
        }

        Chat.log("reg: number of blocks: " + count);
        Chat.log("reg: number of blocks with fake rotation: " + count2);

        Chat.log("reg: number of trees: " + trees.length);

        let file;
        let fileWriter;

        if (trees.length == 0) {
            Chat.log("reg: no trees found");
        } else {
            // getTreePatterns adds the "leafPattern" attribute to each tree object inside trees
            trees = getTreePatterns(trees);
            const treeCode = getTreeCode(trees, version);
            file = new File("treeCrackerCode.txt");
            fileWriter = new FileWriter(file);
            fileWriter.write(treeCode);
            fileWriter.close();
            Chat.log("reg: tree cracker code written to " + file.getAbsolutePath());
            Chat.log("reg: now you can use this code with andrew's treecracker");
        }

        if (blocksWithFakeRotation.length == 0) {
            Chat.log("reg: no blocks with fake rotation found");
            return;
        }

        const rotationCode = getRotationCode(blocksWithFakeRotation);
        file = new File("javaRotationCode.txt");
        fileWriter = new FileWriter(file);
        fileWriter.write(rotationCode);
        fileWriter.close();
        Chat.log("reg: java rotation code written to " + file.getAbsolutePath());
        Chat.log("reg: once you get your result, use \"/reg newpos x y z\" to clone all of your blocks there");

        let counter = 0;
        let newPos = [];
        while (newPos.length == 0) {
            if (counter > 10*60*1000) return;
            newPos = JSON.parse(GlobalVars.getString("newPos"));
            Time.sleep(1000);
            counter += 1000;
        }

        if (blocksWithFakeRotation.length > 0) {
            const [newX, newY, newZ] = newPos;
            const o = blocksWithFakeRotation[0];
            const diffPos = [diffX, diffY, diffZ] =
                [newX - o.getX(), newY - o.getY(), newZ - o.getZ()];

            clone(minPos, maxPos, diffPos);

            Chat.log("reg: blocks cloned");
        } else {
            Chat.log("reg: 0 blocks with fake rotation, can't clone");
        }

        GlobalVars.putString("newPos", "[]");
    }

}

GlobalVars.putString("newPos", "[]");
const w = (fn) => JavaWrapper.methodToJavaAsync(() => fn());
Chat.getCommandManager().createCommandBuilder("reg")
    .literalArg("start").executes(w(() => reg("start", ""))).or()
    .literalArg("clear").executes(w(() => {
        startPos = null;
        Chat.log("reg: clear done");
    })).or()
    .literalArg("end").quotedStringArg("version").executes(
        JavaWrapper.methodToJavaAsync(c => {
            const version = c.getArg("version").toString()
                .replace(/^TextHelper:{"text": "(.*)"}$/, "$1");
            reg("end", version);
        })
    ).or(1)
    .literalArg("newpos").longArg("x").longArg("y").longArg("z").executes(
        JavaWrapper.methodToJavaAsync(c => {
            let newPos = [c.getArg("x"), c.getArg("y"), c.getArg("z")];
            GlobalVars.putString("newPos", JSON.stringify(newPos));
        })
    )
    .register();