import {
  ChainId,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_FANTOM,
  CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  isEVMChain,
  CHAIN_ID_APTOS,
} from "@certusone/wormhole-sdk";
import {
  getOriginalAssetEth,
  getOriginalAssetSol,
  getOriginalAssetAptos,
  WormholeWrappedNFTInfo,
} from "@certusone/wormhole-sdk/lib/esm/nft_bridge";
import {
  Button,
  Card,
  CircularProgress,
  Container,
  makeStyles,
  MenuItem,
  TextField,
  Typography,
} from "@material-ui/core";
import { Launch } from "@material-ui/icons";
import { Alert } from "@material-ui/lab";
import { Connection } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { useBetaContext } from "../contexts/BetaContext";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import useIsWalletReady from "../hooks/useIsWalletReady";
import { getMetaplexData } from "../hooks/useMetaplexData";
import { COLORS } from "../muiTheme";
import { NFTParsedTokenAccount } from "../store/nftSlice";
import {
  BETA_CHAINS,
  CHAINS_BY_ID,
  CHAINS_WITH_NFT_SUPPORT,
  getNFTBridgeAddressForChain,
  SOLANA_HOST,
  SOL_NFT_BRIDGE_ADDRESS,
  getAssetAddressNative,
} from "../utils/consts";
import {
  ethNFTToNFTParsedTokenAccount,
  getEthereumNFT,
  isNFT,
  isValidEthereumAddress,
} from "../utils/ethereum";
import HeaderText from "./HeaderText";
import KeyAndBalance from "./KeyAndBalance";
import NFTViewer from "./TokenSelectors/NFTViewer";
import { getAptosClient } from "../utils/aptos";
import { TokenClient, TokenTypes } from "aptos";

const useStyles = makeStyles((theme) => ({
  mainCard: {
    padding: "32px 32px 16px",
    backgroundColor: COLORS.whiteWithTransparency,
  },
  originHeader: {
    marginTop: theme.spacing(4),
  },
  viewButtonWrapper: {
    textAlign: "center",
  },
  viewButton: {
    marginTop: theme.spacing(1),
  },
  loaderWrapper: {
    margin: theme.spacing(2),
    textAlign: "center",
  },
}));

export default function NFTOriginVerifier() {
  const classes = useStyles();
  const isBeta = useBetaContext();
  const [lookupChain, setLookupChain] = useState<ChainId>(CHAIN_ID_ETH);
  const { provider, signerAddress } = useEthereumProvider(lookupChain as any);
  const { isReady, statusMessage } = useIsWalletReady(lookupChain);
  const [lookupAsset, setLookupAsset] = useState("");
  const [lookupTokenId, setLookupTokenId] = useState("");
  const [lookupCreatorAddress, setLookupCreatorAddress] = useState("");
  const [lookupCollectionName, setLookupCollectionName] = useState("");
  const [lookupTokenName, setLookupTokenName] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [parsedTokenAccount, setParsedTokenAccount] = useState<
    NFTParsedTokenAccount | undefined
  >(undefined);
  const [originInfo, setOriginInfo] = useState<
    WormholeWrappedNFTInfo | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const handleChainChange = useCallback((event) => {
    setLookupChain(event.target.value);
  }, []);
  const handleAssetChange = useCallback((event) => {
    setLookupAsset(event.target.value);
  }, []);
  const handleTokenIdChange = useCallback((event) => {
    setLookupTokenId(event.target.value);
  }, []);
  const handleCreatorAddressChange = useCallback((event) => {
    setLookupCreatorAddress(event.target.value);
  }, []);
  const handleCollectionNameChange = useCallback((event) => {
    setLookupCollectionName(event.target.value);
  }, []);
  const handleTokenNameChange = useCallback((event) => {
    setLookupTokenName(event.target.value);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLookupError("");
    setParsedTokenAccount(undefined);
    setOriginInfo(undefined);
    const hasAptosLookupData =
      lookupChain === CHAIN_ID_APTOS &&
      lookupCreatorAddress &&
      lookupCollectionName &&
      lookupTokenName;
    if (
      isReady &&
      provider &&
      signerAddress &&
      isEVMChain(lookupChain) &&
      lookupAsset &&
      lookupTokenId
    ) {
      if (isValidEthereumAddress(lookupAsset)) {
        (async () => {
          setIsLoading(true);
          try {
            const token = await getEthereumNFT(lookupAsset, provider);
            const result = await isNFT(token);
            if (result) {
              const newParsedTokenAccount = await ethNFTToNFTParsedTokenAccount(
                token,
                lookupTokenId,
                signerAddress
              );
              const info = await getOriginalAssetEth(
                getNFTBridgeAddressForChain(lookupChain),
                provider,
                lookupAsset,
                lookupTokenId,
                lookupChain
              );
              if (!cancelled) {
                setIsLoading(false);
                setParsedTokenAccount(newParsedTokenAccount);
                setOriginInfo(info);
              }
            } else if (!cancelled) {
              setIsLoading(false);
              setLookupError(
                "This token does not support ERC-165, ERC-721, and ERC-721 metadata"
              );
            }
          } catch (e) {
            console.error(e);
            if (!cancelled) {
              setIsLoading(false);
              setLookupError(
                "This token does not support ERC-165, ERC-721, and ERC-721 metadata"
              );
            }
          }
        })();
      } else {
        setLookupError("Invalid address");
      }
    } else if (lookupChain === CHAIN_ID_SOLANA && lookupAsset) {
      (async () => {
        try {
          setIsLoading(true);
          const [metadata] = await getMetaplexData([lookupAsset]);
          if (metadata) {
            const connection = new Connection(SOLANA_HOST, "confirmed");
            const info = await getOriginalAssetSol(
              connection,
              SOL_NFT_BRIDGE_ADDRESS,
              lookupAsset
            );
            if (!cancelled) {
              setIsLoading(false);
              setParsedTokenAccount({
                amount: "0",
                decimals: 0,
                mintKey: lookupAsset,
                publicKey: "",
                uiAmount: 0,
                uiAmountString: "0",
                uri: metadata.data.uri,
              });
              setOriginInfo(info);
            }
          } else {
            if (!cancelled) {
              setIsLoading(false);
              setLookupError("Error fetching metadata");
            }
          }
        } catch (e) {
          console.error(e);
          if (!cancelled) {
            setIsLoading(false);
            setLookupError("Invalid token");
          }
        }
      })();
    } else if (hasAptosLookupData) {
      (async () => {
        try {
          setIsLoading(true);
          const tokenId: TokenTypes.TokenId = {
            token_data_id: {
              creator: lookupCreatorAddress,
              collection: lookupCollectionName,
              name: lookupTokenName,
            },
            property_version: "0",
          };
          const aptosClient = getAptosClient();
          const tokenClient = new TokenClient(aptosClient);
          const info = await getOriginalAssetAptos(
            aptosClient,
            getNFTBridgeAddressForChain(CHAIN_ID_APTOS),
            tokenId
          );
          const { collection, name, uri } = await tokenClient.getTokenData(
            lookupCreatorAddress,
            lookupCollectionName,
            lookupTokenName
          );
          if (!cancelled) {
            setIsLoading(false);
            setParsedTokenAccount({
              amount: "0",
              decimals: 0,
              mintKey: `${collection} ${name}`,
              publicKey: "",
              uiAmount: 0,
              uiAmountString: "0",
              uri,
            });
            setOriginInfo(info);
          }
        } catch (e) {
          console.error(e);
          if (!cancelled) {
            setIsLoading(false);
            setLookupError("Invalid token");
          }
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [
    isReady,
    provider,
    signerAddress,
    lookupChain,
    lookupAsset,
    lookupTokenId,
    lookupCreatorAddress,
    lookupCollectionName,
    lookupTokenName,
  ]);
  const readableAddress = originInfo
    ? getAssetAddressNative(originInfo.assetAddress, originInfo.chainId)
    : undefined;
  const displayError =
    (isEVMChain(lookupChain) && statusMessage) || lookupError;
  return (
    <div>
      <Container maxWidth="md">
        <HeaderText white>NFT Origin Verifier</HeaderText>
      </Container>
      <Container maxWidth="sm">
        <Card className={classes.mainCard}>
          <Alert severity="info" variant="outlined">
            This page allows you to find where a Wormhole-bridged NFT was
            originally minted so you can verify its authenticity.
          </Alert>
          <TextField
            select
            variant="outlined"
            label="Chain"
            value={lookupChain}
            onChange={handleChainChange}
            fullWidth
            margin="normal"
          >
            {CHAINS_WITH_NFT_SUPPORT.filter(({ id }) =>
              isBeta ? true : !BETA_CHAINS.includes(id)
            ).map(({ id, name }) => (
              <MenuItem key={id} value={id}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          {lookupChain === CHAIN_ID_APTOS ? (
            <>
              <TextField
                fullWidth
                variant="outlined"
                margin="normal"
                label="Paste creator address"
                value={lookupCreatorAddress}
                onChange={handleCreatorAddressChange}
              />
              <TextField
                fullWidth
                variant="outlined"
                margin="normal"
                label="Paste collection name"
                value={lookupCollectionName}
                onChange={handleCollectionNameChange}
              />
              <TextField
                fullWidth
                variant="outlined"
                margin="normal"
                label="Paste token name"
                value={lookupTokenName}
                onChange={handleTokenNameChange}
              />
            </>
          ) : (
            <>
              {isEVMChain(lookupChain) && (
                <KeyAndBalance chainId={lookupChain} />
              )}
              <TextField
                fullWidth
                variant="outlined"
                margin="normal"
                label="Paste an address"
                value={lookupAsset}
                onChange={handleAssetChange}
              />
              {isEVMChain(lookupChain) && (
                <TextField
                  fullWidth
                  variant="outlined"
                  margin="normal"
                  label="Paste a tokenId"
                  value={lookupTokenId}
                  onChange={handleTokenIdChange}
                />
              )}
            </>
          )}
          {displayError ? (
            <Typography align="center" color="error">
              {displayError}
            </Typography>
          ) : null}
          {isLoading ? (
            <div className={classes.loaderWrapper}>
              <CircularProgress />
            </div>
          ) : null}
          {parsedTokenAccount ? (
            <NFTViewer value={parsedTokenAccount} chainId={lookupChain} />
          ) : null}
          {originInfo ? (
            <>
              <Typography
                variant="h5"
                gutterBottom
                className={classes.originHeader}
              >
                Origin Info
              </Typography>
              <Typography variant="body2" gutterBottom>
                Chain: {CHAINS_BY_ID[originInfo.chainId].name}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Address: {readableAddress}
              </Typography>
              {originInfo.chainId === CHAIN_ID_SOLANA ? null : (
                <Typography variant="body2" gutterBottom>
                  Token ID: {originInfo.tokenId}
                </Typography>
              )}
              <div className={classes.viewButtonWrapper}>
                {originInfo.chainId === CHAIN_ID_SOLANA ? (
                  <Button
                    href={`https://solscan.io/token/${readableAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<Launch />}
                    className={classes.viewButton}
                    variant="outlined"
                  >
                    View on Solscan
                  </Button>
                ) : originInfo.chainId === CHAIN_ID_BSC ? (
                  <Button
                    href={`https://bscscan.com/token/${readableAddress}?a=${originInfo.tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<Launch />}
                    className={classes.viewButton}
                    variant="outlined"
                  >
                    View on BscScan
                  </Button>
                ) : originInfo.chainId === CHAIN_ID_POLYGON ? (
                  <Button
                    href={`https://opensea.io/assets/matic/${readableAddress}/${originInfo.tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<Launch />}
                    className={classes.viewButton}
                    variant="outlined"
                  >
                    View on OpenSea
                  </Button>
                ) : originInfo.chainId === CHAIN_ID_AVAX ? (
                  <Button
                    href={`https://avascan.info/blockchain/c/token/${readableAddress}?a=${originInfo.tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<Launch />}
                    className={classes.viewButton}
                    variant="outlined"
                  >
                    View on Avascan
                  </Button>
                ) : originInfo.chainId === CHAIN_ID_AURORA ? (
                  <Button
                    href={`https://aurorascan.dev/token/${readableAddress}?a=${originInfo.tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<Launch />}
                    className={classes.viewButton}
                    variant="outlined"
                  >
                    View on Explorer
                  </Button>
                ) : originInfo.chainId === CHAIN_ID_FANTOM ? (
                  <Button
                    href={`https://ftmscan.com/token/${readableAddress}?a=${originInfo.tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<Launch />}
                    className={classes.viewButton}
                    variant="outlined"
                  >
                    View on FTMScan
                  </Button>
                ) : originInfo.chainId === CHAIN_ID_OASIS ? null : (
                  <Button
                    href={`https://opensea.io/assets/${readableAddress}/${originInfo.tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<Launch />}
                    className={classes.viewButton}
                    variant="outlined"
                  >
                    View on OpenSea
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </Card>
      </Container>
    </div>
  );
}
