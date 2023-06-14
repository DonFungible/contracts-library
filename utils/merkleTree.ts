import { ethers } from 'hardhat';
import { MerkleTree } from 'merkletreejs';

export const buildTree = (leaves: string[]) => {
    return new MerkleTree(
        leaves.map(l => ethers.utils.solidityKeccak256(['address'], [l])),
        ethers.utils.keccak256,
        { sort: true }
    );
};

export const getProof = (tree: MerkleTree, address?: string | null) => {
    if (!address) {
        return null;
    }

    return tree.getHexProof(ethers.utils.solidityKeccak256(['address'], [address.toLowerCase()]));
};

export const computeMerkleRoot = (leaves: string[]) => {
    const tree = buildTree(leaves);
    return tree.getHexRoot();
};

export const computeMerkleProof = (leaves: string[], address?: string | null) => {
    if (!address) {
        return null;
    }

    const tree = buildTree(leaves);
    return getProof(tree, address);
};
