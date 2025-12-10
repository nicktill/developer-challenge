// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title AssetLibrary
 * @notice Simple asset checkout system - like a library for equipment
 * @dev Users can register, create assets, check them out and return them
 */
contract AssetLibrary {
    
    // State variables
    uint256 private nextAssetId;
    address public immutable owner;
    
    // User mappings
    mapping(address => string) public userNames;
    mapping(address => bool) public isRegistered;
    
    // Asset data structure
    
    struct Asset {
        uint256 id;
        bool exists;
        bool isAvailable;
        address currentHolder;
        uint256 checkoutTime;
    }
    
    mapping(uint256 => Asset) public assets;
    
    // Events
    
    event UserRegistered(
        address indexed user,
        string name
    );
    
    event AssetRegistered(
        uint256 indexed assetId,
        address indexed registeredBy
    );
    
    event AssetCheckedOut(
        uint256 indexed assetId,
        address indexed user,
        uint256 timestamp
    );
    
    event AssetReturned(
        uint256 indexed assetId,
        address indexed user,
        uint256 timestamp
    );
    
    // ============ Errors ============
    
    error AssetNotFound(uint256 assetId);
    error AssetNotAvailable(uint256 assetId);
    error AssetNotCheckedOut(uint256 assetId);
    error NotCurrentHolder(uint256 assetId, address caller);
    error NotRegistered(address caller);
    
    // ============ Constructor ============
    
    constructor() {
        owner = msg.sender;
        nextAssetId = 1;
    }
    
    // ============ Modifiers ============
    
    /**
     * @notice Ensures only registered users can perform asset operations
     */
    modifier onlyRegistered() {
        if (!isRegistered[msg.sender]) revert NotRegistered(msg.sender);
        _;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Register a user (permissions only, metadata stored off-chain)
     * @param name Minimal identifier for events (rich profile data stored off-chain)
     * @dev Hybrid approach: on-chain permissions, off-chain profile data
     */
    function registerUser(string memory name) external {
        userNames[msg.sender] = name; // Keep minimal on-chain for events
        isRegistered[msg.sender] = true;
        emit UserRegistered(msg.sender, name);
    }
    
    /**
     * @notice Register a new asset in the system
     * @return assetId The ID of the newly registered asset
     * @dev Off-chain systems should store additional metadata (name, description, etc.)
     */
    function registerAsset() external onlyRegistered returns (uint256) {
        uint256 assetId = nextAssetId++;
        
        assets[assetId] = Asset({
            id: assetId,
            exists: true,
            isAvailable: true,
            currentHolder: address(0),
            checkoutTime: 0
        });
        
        emit AssetRegistered(assetId, msg.sender);
        
        return assetId;
    }
    
    /**
     * @notice Check out an available asset
     * @param assetId The ID of the asset to check out
     */
    function checkOut(uint256 assetId) external onlyRegistered {
        Asset storage asset = assets[assetId];
        
        if (!asset.exists) {
            revert AssetNotFound(assetId);
        }
        if (!asset.isAvailable) {
            revert AssetNotAvailable(assetId);
        }
        
        asset.isAvailable = false;
        asset.currentHolder = msg.sender;
        asset.checkoutTime = block.timestamp;
        
        emit AssetCheckedOut(assetId, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Return a currently checked-out asset
     * @param assetId The ID of the asset to return
     */
    function returnAsset(uint256 assetId) external onlyRegistered {
        Asset storage asset = assets[assetId];
        
        if (!asset.exists) {
            revert AssetNotFound(assetId);
        }
        if (asset.isAvailable) {
            revert AssetNotCheckedOut(assetId);
        }
        if (asset.currentHolder != msg.sender) {
            revert NotCurrentHolder(assetId, msg.sender);
        }
        
        asset.isAvailable = true;
        asset.currentHolder = address(0);
        asset.checkoutTime = 0;
        
        emit AssetReturned(assetId, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Get details of an asset
     * @param assetId The ID of the asset to query
     * @return Asset struct with current state
     */
    function getAsset(uint256 assetId) external view returns (Asset memory) {
        if (!assets[assetId].exists) {
            revert AssetNotFound(assetId);
        }
        return assets[assetId];
    }
    
    /**
     * @notice Get the total number of registered assets
     * @return The count of assets registered
     */
    function getAssetCount() external view returns (uint256) {
        return nextAssetId - 1;
    }
    
    /**
     * @notice Get the display name for a user
     * @param user The address of the user
     * @return The user's display name, or empty string if not registered
     */
    function getUserName(address user) external view returns (string memory) {
        return userNames[user];
    }
    
    /**
     * @notice Check if a user is registered
     * @param user The address of the user to check
     * @return True if the user is registered, false otherwise
     */
    function isUserRegistered(address user) external view returns (bool) {
        return isRegistered[user];
    }
}
