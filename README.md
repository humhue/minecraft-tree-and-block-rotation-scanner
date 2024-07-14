# What is this?
This is a macro for JSMacros which can be used to get texture rotation data, or tree data. Don't use it with older JSMacros versions (definitely not 1.8 or 1.12.2 because they're really outdated), you can almost always use more recent versions.

# How do I use it?
Execute "/reg start" to register your starting position, then "/reg end {version}" with version being one of ["1.6.4", "1.8.9", "1.12.2", "1.14.4", "1.15.2", "1.16.1", "1.16.4"], to register your final position.\
The macro will take all the blocks inside the specified range and check for rotation blocks (if any) and trees (if any).\
It then generates the code for the texture rotation finder (https://github.com/19MisterX98/TextureRotations) and the treecracker (https://github.com/Gaider10/TreeCracker).

If you're using it to get tex rots, it will generate the block rotation formation, print it to a file, and will then wait up to ten minutes for you to insert the new position you got from the texture rotation finder using the command "/reg new {x} {y} {z}".
Once you provide it the new position (if you do), the macro will clone all the blocks found in the range to that position.\
\
If you're using it to get tree data, be sure to use oak or birch leaves to represent leaves that are present and (normal) glass to represent absent ones in your recreation.\
If you dont know whether a leaf is present or not, feel free to use any other block, such as red wool or red glass or air.\
To indicate you don't know a tree's height, you can use a height of 3.\
Please note that the 3 UPPER logs will still need to be placed DIRECTLY ON a dirt block to complete the tree representation.\
Like this: dirt -> log -> log -> log -> leaf on top (not strictly necessary). You can place a maximum of 3 other logs between the dirt block and the third to last log, so if I know a tree's height is 4, I just place an extra one.\
If two or more trees share a leaf (same coordinates), the macro will check whether that specific leaf is a random one for any of the trees involved. The macro will then act correctly based on all possible cases.
