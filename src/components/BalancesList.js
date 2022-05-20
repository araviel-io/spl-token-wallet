import React, { useState, useMemo, useCallback, useEffect } from 'react';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Paper from '@material-ui/core/Paper';
import {
  refreshWalletPublicKeys,
  useBalanceInfo,
  useWallet,
  useWalletPublicKeys,
  useWalletSelector,
} from '../utils/wallet';
import { findAssociatedTokenAddress } from '../utils/tokens';
import LoadingIndicator from './LoadingIndicator';
import Collapse from '@material-ui/core/Collapse';
import { Grid, Typography } from '@material-ui/core';
import TokenInfoDialog from './TokenInfoDialog';
import FtxPayDialog from './FtxPay/FtxPayDialog';
import Link from '@material-ui/core/Link';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import { makeStyles } from '@material-ui/core/styles';
import { abbreviateAddress, useIsExtensionWidth } from '../utils/utils';
import Button from '@material-ui/core/Button';
import SendIcon from '@material-ui/icons/Send';
import ReceiveIcon from '@material-ui/icons/WorkOutline';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import AddIcon from '@material-ui/icons/Add';
import RefreshIcon from '@material-ui/icons/Refresh';
import IconButton from '@material-ui/core/IconButton';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import Tooltip from '@material-ui/core/Tooltip';
import EditIcon from '@material-ui/icons/Edit';
import MergeType from '@material-ui/icons/MergeType';
import SortIcon from '@material-ui/icons/Sort';
import DeleteIcon from '@material-ui/icons/Delete';
import AddTokenDialog from './AddTokenDialog';
import ExportAccountDialog from './ExportAccountDialog';
import ftxPayIcon from './FtxPay/icon.png';
import SendDialog from './SendDialog';
import DepositDialog from './DepositDialog';
import {
  useIsProdNetwork,
  refreshAccountInfo,
  useSolanaExplorerUrlSuffix,
} from '../utils/connection';
import { useRegion } from '../utils/region';
import { CopyToClipboard } from 'react-copy-to-clipboard';
//import { serumMarkets, priceStore } from '../utils/markets';
//import { swapApiRequest } from '../utils/swap/api';
//import { showSwapAddress } from '../utils/config';
import { useAsyncData } from '../utils/fetch-loop';
import { showTokenInfoDialog } from '../utils/config';
import { useConnection } from '../utils/connection';
import { shortenAddress } from '../utils/utils';
import CloseTokenAccountDialog from './CloseTokenAccountButton';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import TokenIcon from './TokenIcon';
import EditAccountNameDialog from './EditAccountNameDialog';
/*import MergeAccountsDialog from './MergeAccountsDialog';
import SwapButton from './SwapButton';
import DnsIcon from '@material-ui/icons/Dns';
import DomainsList from './DomainsList';*/
import { ToggleButton } from '@material-ui/lab';
//import { Metadata } from "@j0nnyboi/mpl-token-metadata";
import { Metadata } from '@leda-mint-io/lpl-token-metadata/dist/deprecated';
import { Connection, PublicKey } from '@safecoin/web3.js'
import gradientAvatar from 'gradient-avatar';
import { inherits } from 'util';
import InlineSVG from 'svg-inline-react';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import CircularProgress from '@material-ui/core/CircularProgress';
import Modal from '@material-ui/core/Modal';
import Backdrop from '@material-ui/core/Backdrop';
import Fade from '@material-ui/core/Fade';

const useNFTStyles = makeStyles((theme) => ({
  nftContainer: {
    border: '1px solid #ededed',
    width: 210,
    height: 280,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginTop: 12
  },
  nftSubcontainer: {
    height: '100%',
    width: '100%',
    minHeight: 'inherit',
    display: 'flex',
    flexFlow: 'column'
  },
  center: {
    alignItems: 'center'
  },
  assetContainer: {
    height: 214,
    width: 208,
  },
  noImageLoader: {
    width: 208,
    height: 214,
    maxWidth: '100%',
    maxHeight: '100%',
    animationDuration: '2s',
    animationFillMode: 'forwards',
    animationIterationCount: 'infinite',
    animationName: 'placeHolderShimmer',
    animationTimingFunction: 'linear',
    backgroundColor: '#f6f7f8',
    background: 'linear-gradient(to right, #eeeeee 8%, #bbbbbb 18%, #eeeeee 33%)',
    backgroundSize: '800px 104px',
    position: 'relative'
  },
  Asset: {
    objecFit: 'cover',
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxheight: '100%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    // backgroundImage: 'url(https://cdn1.iconfinder.com/data/icons/business-company-1/500/image-512.png)',
    backgroundPosition: 'center',
    backgroundSize: 'cover'
  },
  modal: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paper: {
    backgroundColor: theme.palette.background.paper,
    border: '2px solid #000',
    boxShadow: theme.shadows[5],
    padding: theme.spacing(2, 4, 3),
  },
}));


const balanceFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
  useGrouping: true,
});

const SortAccounts = {
  None: 0,
  Ascending: 1,
  Descending: 2,
};

// Aggregated $USD values of all child BalanceListItems child components.
//
// Values:
// * undefined => loading.
// * null => no market exists.
// * float => done.
//
// For a given set of publicKeys, we know all the USD values have been loaded when
// all of their values in this object are not `undefined`.
const usdValues = {};

// Calculating associated token addresses is an asynchronous operation, so we cache
// the values so that we can quickly render components using them. This prevents
// flickering for the associated token fingerprint icon.
const associatedTokensCache = {};

const numberFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function fairsIsLoaded(publicKeys) {
  return (
    publicKeys.filter((pk) => usdValues[pk.toString()] !== undefined).length ===
    publicKeys.length
  );
}

export default function BalancesList() {
  const wallet = useWallet();
  const [publicKeys, loaded] = useWalletPublicKeys();
  const [showAddTokenDialog, setShowAddTokenDialog] = useState(false);
  const [showNft, setShowNft] = useState(false);
  const [showEditAccountNameDialog, setShowEditAccountNameDialog] = useState(
    false,
  );
  //const [showMergeAccounts, setShowMergeAccounts] = useState(false);
  // const [showFtxPayDialog, setShowFtxPayDialog] = useState(false);
  const [sortAccounts, setSortAccounts] = useState(SortAccounts.None);
  //const [showDomains, setShowDomains] = useState(false);
  const { accounts, setAccountName } = useWalletSelector();
  const [isCopied, setIsCopied] = useState(false);
  const isExtensionWidth = useIsExtensionWidth();
  // Dummy var to force rerenders on demand.
  const [, setForceUpdate] = useState(false);
  //const region = useRegion();
  const selectedAccount = accounts.find((a) => a.isSelected);
  const allTokensLoaded = loaded && fairsIsLoaded(publicKeys);
  let sortedPublicKeys = publicKeys;
  if (allTokensLoaded && sortAccounts !== SortAccounts.None) {
    sortedPublicKeys = [...publicKeys];
    sortedPublicKeys.sort((a, b) => {
      const aVal = usdValues[a.toString()];
      const bVal = usdValues[b.toString()];

      a = aVal === undefined || aVal === null ? -1 : aVal;
      b = bVal === undefined || bVal === null ? -1 : bVal;
      if (sortAccounts === SortAccounts.Descending) {
        if (a < b) {
          return -1;
        } else if (a > b) {
          return 1;
        } else {
          return 0;
        }
      } else {
        if (b < a) {
          return -1;
        } else if (b > a) {
          return 1;
        } else {
          return 0;
        }
      }
    });
  }
  const totalUsdValue = publicKeys
    .filter((pk) => usdValues[pk.toString()])
    .map((pk) => usdValues[pk.toString()])
    .reduce((a, b) => a + b, 0.0);

  // Memoized callback and component for the `BalanceListItems`.
  //
  // The `BalancesList` fetches data, e.g., fairs for tokens using React hooks
  // in each of the child `BalanceListItem` components. However, we want the
  // parent component, to aggregate all of this data together, for example,
  // to show the cumulative USD amount in the wallet.
  //
  // To achieve this, we need to pass a callback from the parent to the chlid,
  // so that the parent can collect the results of all the async network requests.
  // However, this can cause a render loop, since invoking the callback can cause
  // the parent to rerender, which causese the child to rerender, which causes
  // the callback to be invoked.
  //
  // To solve this, we memoize all the `BalanceListItem` children components.
  const setUsdValuesCallback = useCallback(
    (publicKey, usdValue) => {
      if (usdValues[publicKey.toString()] !== usdValue) {
        usdValues[publicKey.toString()] = usdValue;
        if (fairsIsLoaded(publicKeys)) {
          setForceUpdate((forceUpdate) => !forceUpdate);
        }
      }
    },
    [publicKeys],
  );
  const balanceListItemsMemo = useMemo(() => {
    return sortedPublicKeys.map((pk) => {
      return React.memo((props) => {
        return (<>
          <BalanceListItem
            key={pk.toString()}
            publicKey={pk}
            setUsdValue={setUsdValuesCallback}
          />
        </>
        );
      });
    });
  }, [sortedPublicKeys, setUsdValuesCallback]);

  const NFTListItemsMemo = useMemo(() => {
    return sortedPublicKeys.map((pk) => {
      return React.memo((props) => {
        return (<>
          <NFTListItem
            key={pk.toString()}
            publicKey={pk}
            setUsdValue={setUsdValuesCallback}
          />
        </>
        );
      });
    });
  }, [sortedPublicKeys, setUsdValuesCallback]);
  // test()
  //console.log("sortedPublicKeys ", sortedPublicKeys)

  const useStylesGrid = makeStyles((theme) => ({
    root: {
      flexGrow: 1,
    },
    paper: {
      padding: theme.spacing(2),
      textAlign: 'center',
      color: theme.palette.text.secondary,
    },
  }));

  const gridClasses = useStylesGrid();
  const iconSize = isExtensionWidth ? 'small' : 'medium';
  //const classes = useStyless();
  return (
    <Paper>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <CopyToClipboard
            text={selectedAccount && selectedAccount.address.toBase58()}
            onCopy={() => {
              setIsCopied(true);
              setTimeout(() => {
                setIsCopied(false);
              }, 1000);
            }}
          >
            <Tooltip
              title={
                <Typography>
                  {isCopied ? 'Copied' : 'Copy to clipboard'}
                </Typography>
              }
              style={{ fontSize: '10rem' }}
            >
              <Typography
                variant="h6"
                style={{
                  flexGrow: 1,
                  fontSize: isExtensionWidth && '1rem',
                  cursor: 'pointer',
                }}
                hover={true}
                component="h2"
              >
                {selectedAccount && selectedAccount.name}
                {isExtensionWidth
                  ? ''
                  : ` (${selectedAccount &&
                  shortenAddress(selectedAccount.address.toBase58())
                  })`}{' '}
                {/*allTokensLoaded && (
                  <>({numberFormat.format(totalUsdValue.toFixed(2))})</>
                )*/}
              </Typography>
            </Tooltip>
          </CopyToClipboard>
          {selectedAccount &&
            selectedAccount.name !== 'Main account' &&
            selectedAccount.name !== 'Hardware wallet' && (
              <Tooltip title="Edit Account Name" arrow>
                <IconButton
                  size={iconSize}
                  onClick={() => setShowEditAccountNameDialog(true)}
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
            )}
          {/*<Tooltip title="Deposit via FTX Pay" arrow>
            <IconButton
              size={iconSize}
              onClick={() => setShowFtxPayDialog(true)}
            >
              <img
                title={'FTX Pay'}
                alt={'FTX Pay'}
                style={{
                  width: 20,
                  height: 20,
                }}
                src={ftxPayIcon}
              />
            </IconButton>
          </Tooltip>*/}
          {/*
          <Tooltip title="See your domains" arrow>
            <IconButton size={iconSize} onClick={() => setShowDomains(true)}>
              <DnsIcon />
            </IconButton>
          </Tooltip>
          */}
          {/*
          <DomainsList open={showDomains} setOpen={setShowDomains} />
          {region.result && !region.result.isRestricted && <SwapButton size={iconSize} />}
          <Tooltip title="Migrate Tokens" arrow>
            <IconButton
              size={iconSize}
              onClick={() => setShowMergeAccounts(false)}
            >
              <MergeType />
            </IconButton>
          </Tooltip>
          */}
          <ToggleButton
            value=""
            selected={showNft}
            onChange={() => {
              showNft ? setShowNft(false) : setShowNft(true);
            }}
          >
            <div style={{ fontSize: 'initial', fontWeight: 'bold' }}>NFT</div>
          </ToggleButton>
          <Tooltip title="Add Token" arrow>
            <IconButton
              size={iconSize}
              onClick={() => setShowAddTokenDialog(true)}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Sort Tokens" arrow>
            <IconButton
              size={iconSize}
              onClick={() => {
                switch (sortAccounts) {
                  case SortAccounts.None:
                    setSortAccounts(SortAccounts.Ascending);
                    return;
                  case SortAccounts.Ascending:
                    setSortAccounts(SortAccounts.Descending);
                    return;
                  case SortAccounts.Descending:
                    setSortAccounts(SortAccounts.None);
                    return;
                  default:
                    console.error('invalid sort type', sortAccounts);
                }
              }}
            >
              <SortIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh" arrow>
            <IconButton
              size={iconSize}
              onClick={() => {
                refreshWalletPublicKeys(wallet);
                publicKeys.map((publicKey) =>
                  refreshAccountInfo(wallet.connection, publicKey, true),
                );
              }}
              style={{ marginRight: -12 }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      {showNft ?
        <div className={gridClasses.root}>
          <Grid style={{ justifyContent: 'space-around' }} direction="row"
            justifyContent="space-evenly"
            alignItems="flex-start" container spacing={0}>
            {NFTListItemsMemo.map((Memoized) => (
              <Memoized />
            ))}
            {loaded ? null : <LoadingIndicator />}
            {/*itemData.map((item) => (
            <div> 
              <img style={{maxWidth:'280px'}} src={item.img} alt={item.title} />
              <IconButton aria-label={`info about ${item.title}`} className={classes.icon}>
                <InfoIcon />
              </IconButton>
            </div>
          ))*/}
          </Grid>
        </div>
        :
        <List disablePadding>
          {balanceListItemsMemo.map((Memoized) => (
            <Memoized />
          ))}
          {loaded ? null : <LoadingIndicator />}
        </List>
      }
      <AddTokenDialog
        open={showAddTokenDialog}
        onClose={() => setShowAddTokenDialog(false)}
      />

      <EditAccountNameDialog
        open={showEditAccountNameDialog}
        onClose={() => setShowEditAccountNameDialog(false)}
        oldName={selectedAccount ? selectedAccount.name : ''}
        onEdit={(name) => {
          setAccountName(selectedAccount.selector, name);
          setShowEditAccountNameDialog(false);
        }}
      />
    </Paper>
  );
}

const useStyles = makeStyles((theme) => ({
  address: {
    textOverflow: 'ellipsis',
    overflowX: 'hidden',
  },
  itemDetails: {
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'space-evenly',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  viewDetails: {
    '&:hover': {
      cursor: 'pointer',
    },
  },
}));

export function BalanceListItem({ publicKey, expandable, setUsdValue }) {
  const wallet = useWallet();
  const balanceInfo = useBalanceInfo(publicKey);
  const classes = useStyles();
  const connection = useConnection();
  const [open, setOpen] = useState(false);
  const isExtensionWidth = useIsExtensionWidth();
  const [, setForceUpdate] = useState(false);
  const [metaState, setMetaState] = useState();
  // Valid states:
  //   * undefined => loading.
  //   * null => not found.
  //   * else => price is loaded.
  const [price, setPrice] = useState(undefined);
  useEffect(() => {
    if (balanceInfo) {
      if (balanceInfo.tokenSymbol) {
        const coin = balanceInfo.tokenSymbol.toUpperCase();
        // Don't fetch USD stable coins. Mark to 1 USD.
        if (coin === 'USDT' || coin === 'USDC') {
          setPrice(1);
        }
        // A Serum market exists. Fetch the price.
        /*else if (serumMarkets[coin]) {
          let m = serumMarkets[coin];
          priceStore
            .getPrice(connection, m.name)
            .then((price) => {
              setPrice(price);
            })
            .catch((err) => {
              console.error(err);
              setPrice(null);
            });
        }*/
        // No Serum market exists.
        else {
          setPrice(null);
        }
      }
      // No token symbol so don't fetch market data.
      else {
        setPrice(null);
      }
    }
  }, [price, balanceInfo, connection]);

  expandable = expandable === undefined ? true : expandable;

  if (!balanceInfo) {
    return <LoadingIndicator delay={0} />;
  }

  let {
    amount,
    decimals,
    mint,
    tokenName,
    tokenSymbol,
    tokenLogoUri,
  } = balanceInfo;
  tokenName = tokenName ?? abbreviateAddress(mint);
  let displayName;
  if (isExtensionWidth) {
    displayName = tokenSymbol ?? tokenName;
  } else {
    displayName = tokenName + (tokenSymbol ? ` (${tokenSymbol})` : '');
  }

  // Fetch and cache the associated token address.
  if (wallet && wallet.publicKey && mint) {
    if (
      associatedTokensCache[wallet.publicKey.toString()] === undefined ||
      associatedTokensCache[wallet.publicKey.toString()][mint.toString()] ===
      undefined
    ) {
      findAssociatedTokenAddress(wallet.publicKey, mint).then((assocTok) => {
        let walletAccounts = Object.assign(
          {},
          associatedTokensCache[wallet.publicKey.toString()],
        );
        walletAccounts[mint.toString()] = assocTok;
        associatedTokensCache[wallet.publicKey.toString()] = walletAccounts;
        if (assocTok.equals(publicKey)) {
          // Force a rerender now that we've cached the value.
          setForceUpdate((forceUpdate) => !forceUpdate);
        }
      });
    }
  }

  // undefined => not loaded.
  let isAssociatedToken = mint ? undefined : false;
  if (
    wallet &&
    wallet.publicKey &&
    mint &&
    associatedTokensCache[wallet.publicKey.toString()]
  ) {
    let acc =
      associatedTokensCache[wallet.publicKey.toString()][mint.toString()];
    if (acc) {
      if (acc.equals(publicKey)) {
        isAssociatedToken = true;
      } else {
        isAssociatedToken = false;
      }
    }
  }

  const subtitle =
    isExtensionWidth || !publicKey.equals(balanceInfo.owner) ? undefined : (
      <div style={{ display: 'flex', height: '20px', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          {publicKey.toBase58()}
        </div>
      </div>
    );

  const usdValue =
    price === undefined // Not yet loaded.
      ? undefined
      : price === null // Loaded and empty.
        ? null
        : ((amount / Math.pow(10, decimals)) * price).toFixed(2); // Loaded.
  if (setUsdValue && usdValue !== undefined) {
    setUsdValue(publicKey, usdValue === null ? null : parseFloat(usdValue));
  }

  return (
    <>
      <ListItem button onClick={() => expandable && setOpen((open) => !open)}>
        <ListItemIcon>
          <TokenIcon
            mint={mint}
            tokenName={tokenName}
            url={tokenLogoUri}
            size={28}
          />
        </ListItemIcon>
        <div style={{ display: 'flex', flex: 1 }}>
          <ListItemText
            primary={
              <>
                {balanceFormat.format(amount / Math.pow(10, decimals))}{' '}
                {displayName}
              </>
            }
            secondary={subtitle}
            secondaryTypographyProps={{ className: classes.address }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexDirection: 'column',
            }}
          >
            {price && (
              <Typography color="textSecondary">
                {numberFormat.format(usdValue)}
              </Typography>
            )}
          </div>
        </div>
        {expandable ? open ? <ExpandLess /> : <ExpandMore /> : <></>}
      </ListItem>
      {expandable && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <BalanceListItemDetails
            isAssociatedToken={isAssociatedToken}
            publicKey={publicKey}
            // serumMarkets={serumMarkets}
            balanceInfo={balanceInfo}
          />
        </Collapse>
      )}
    </>
  );
}

// TODO: loader when loading nfts meta & media
//        if 404 pic let loader runs
// filter duplicates
export function NFTListItem({ publicKey, expandable, setUsdValue }) {
  const wallet = useWallet();
  const balanceInfo = useBalanceInfo(publicKey);
  const classes = useStyles();
  const nftStyles = useNFTStyles();
  const connection = useConnection();
  const [open, setOpen] = useState(false);
  const isExtensionWidth = useIsExtensionWidth();
  const [, setForceUpdate] = useState(false);
  const [IsNFTBroken, setIsNFTBroken] = useState(false);
  const [NFTMetaLoaded, setNFTMetaLoaded] = useState(false);
  const [IsNFTImageError, setIsNFTImageError] = useState(false);
  const [nftUri, setNFTUri] = useState();
  const [NFTName, setNFTName] = useState('Name');
  const [NFTCreator, setNFTCreators] = useState('empty');
  const [NFTImage, setNFTImage] = useState();
  // Valid states:
  //   * undefined => loading.
  //   * null => not found.
  //   * else => price is loaded.
  const [price, setPrice] = useState(undefined);
  useEffect(() => {
    if (balanceInfo) {
      if (balanceInfo.tokenSymbol) {
        const coin = balanceInfo.tokenSymbol.toUpperCase();
        // Don't fetch USD stable coins. Mark to 1 USD.
        if (coin === 'USDT' || coin === 'USDC') {
          setPrice(1);
        }
        else {
          setPrice(null);
        }
      }
      // No token symbol so don't fetch market data.
      else {
        setPrice(null);
      }
    }
  }, [price, balanceInfo, connection]);

  useEffect(() => {
    // declare the async data fetching function
    const storeNFTS = async () => {
      const META = await loadNfts();
      console.log("NFT META", META)
      if (META === undefined) {
        // maybe unminted, need to find out why some of nft don't have meta
        setIsNFTBroken(true)
      } else {
        setNFTMetaLoaded(true)
        setNFTUri(META['data']['data'].uri)
        setNFTName(META['data']['data'].name)
        setNFTCreators(META['data']['data']['creators'][0].address)
        //setNFTCreators()

        if (META['data']['data'].uri === '' || META['data']['data'].uri === undefined) {

        } else {

          try {
            // ⛔️ TypeError: Failed to fetch
            // 👇️ incorrect or incomplete URL
            // this part is only for retrieving arweave image 'from' nft metadata
            const response = await fetch(META['data']['data'].uri, { cache: 'reload' });
            const data = await response.json();
            if (!response.ok) {
              throw new Error(`Error! status: ${response.status}`);
            }
            setNFTImage(data.image)
            console.log("data", data.image);
            const result = await response.json();
            return result;
          } catch (err) {
            //console.log("Arweave not responding", err);
            // means that meta data is here but the uri fetched from safestore / arweave returns 404 or missing asset
            setIsNFTImageError(true);
          }

        }
        loadNftImageFromSafestore(META['data']['data'].uri);
        // console.log("allo uri ? ", a['data']['data'].uri)
      }

      // return a;
    };
    storeNFTS();

  }, [])

  expandable = expandable === undefined ? true : expandable;

  if (!balanceInfo) {
    return <LoadingIndicator delay={0} />;
  }

  let {
    amount,
    decimals,
    mint,
    tokenName,
    tokenSymbol,
    tokenLogoUri,
  } = balanceInfo;
  tokenName = tokenName ?? abbreviateAddress(mint);
  let displayName;
  if (isExtensionWidth) {
    displayName = tokenSymbol ?? tokenName;
  } else {
    displayName = tokenName + (tokenSymbol ? ` (${tokenSymbol})` : '');
  }

  // Fetch and cache the associated token address.
  if (wallet && wallet.publicKey && mint) {
    if (
      associatedTokensCache[wallet.publicKey.toString()] === undefined ||
      associatedTokensCache[wallet.publicKey.toString()][mint.toString()] ===
      undefined
    ) {
      findAssociatedTokenAddress(wallet.publicKey, mint).then((assocTok) => {
        let walletAccounts = Object.assign(
          {},
          associatedTokensCache[wallet.publicKey.toString()],
        );
        walletAccounts[mint.toString()] = assocTok;
        associatedTokensCache[wallet.publicKey.toString()] = walletAccounts;
        if (assocTok.equals(publicKey)) {
          // Force a rerender now that we've cached the value.
          setForceUpdate((forceUpdate) => !forceUpdate);
        }
      });
    }
  }

  // undefined => not loaded.
  let isAssociatedToken = mint ? undefined : false;
  if (
    wallet &&
    wallet.publicKey &&
    mint &&
    associatedTokensCache[wallet.publicKey.toString()]
  ) {
    let acc =
      associatedTokensCache[wallet.publicKey.toString()][mint.toString()];
    if (acc) {
      if (acc.equals(publicKey)) {
        isAssociatedToken = true;
      } else {
        isAssociatedToken = false;
      }
    }
  }

  const subtitle =
    isExtensionWidth || !publicKey.equals(balanceInfo.owner) ? undefined : (
      <div style={{ display: 'flex', height: '20px', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          {publicKey.toBase58()}
        </div>
      </div>
    );

  const usdValue =
    price === undefined // Not yet loaded.
      ? undefined
      : price === null // Loaded and empty.
        ? null
        : ((amount / Math.pow(10, decimals)) * price).toFixed(2); // Loaded.
  if (setUsdValue && usdValue !== undefined) {
    setUsdValue(publicKey, usdValue === null ? null : parseFloat(usdValue));
  }

  async function loadNfts() {
    try {

      let mintPubkey = new PublicKey(mint);
      let tokenmetaPubkey = await Metadata.getPDA(mintPubkey);
      //console.log("tokenmetaPubkey ", tokenmetaPubkey.toBase58())
      const tokenmeta = await Metadata.load(connection, tokenmetaPubkey);
      let dataArr = Array.from(tokenmeta);
      //console.log("tokenmetatokenmeta ", tokenmeta)
      const obj = JSON.parse(tokenmeta);
      return obj;
    }
    catch (e) {
      //console.log(e, "error")
    }

  }

  async function loadNftImageFromSafestore() {
    var txtFile = new XMLHttpRequest();
    txtFile.open("GET", "http://safestore.testnet.darkartlabs.tech:1984/lBCNu9s7pgMq5Ha-wi6R1Nd7UR563aBzMTpGvfykAPQ", true);
    txtFile.onreadystatechange = function () {
      const allText = txtFile.responseText;
      console.log("allTextallText ", allText)
      if (txtFile.readyState === 4) {
        if (txtFile.status === 200) {

          //lines = txtFile.responseText.split("\n"); // Will separate each line into an array
        }
      }
    }
  }

  function generateAvatar() {
    let a = gradientAvatar(NFTCreator.toString(), 28)
    //console.log("avatar : ", a)
    return (<InlineSVG src={a} />)

  }
  function abbreviateAddressString(address) {
    return address.slice(0, 4) + '…' + address.slice(address.length - 4);
  }
  //console.log("IsNFTImageError ", IsNFTImageError)
  //console.log("CREATOR ", NFTCreator)
  return (
    <>
      <div button onClick={() => expandable && setOpen((open) => !open)} className={nftStyles.nftContainer} style={IsNFTBroken ? { display: 'none' } : {}}>
        <div className={nftStyles.nftSubcontainer} style={!NFTMetaLoaded ? { opacity: '0.2' } : {}}>
          <div className={nftStyles.center}>
            <div className={nftStyles.assetContainer}>
              {!NFTImage != '' ?
                <div className={nftStyles.Asset} >
                  <div style={{
                    position: 'relative',
                    top: '40%',
                    textAlign: 'center',
                    opacity: 0.3
                  }}>
                    <CircularProgress disableShrink />
                  </div>
                </div>
                :
                <div className={nftStyles.Asset} style={{ backgroundImage: 'url(' + NFTImage + ')' }}>

                </div>
              }

            </div>
          </div>
          <div style={{ padding: 5 }}>
            <div>{NFTName}</div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ clipPath: 'circle(11px at center)' }}>{generateAvatar()}</div>
              <div>by {abbreviateAddressString(NFTCreator)}</div>
              <div style={{marginLeft:'8px'}}><CheckCircleIcon color="primary" fontSize="small" /></div>
            </div>
          </div>
        </div>
      </div>
      {/*expandable && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <BalanceListItemDetails
            isAssociatedToken={isAssociatedToken}
            publicKey={publicKey}
            // serumMarkets={serumMarkets}
            balanceInfo={balanceInfo}
          />
        </Collapse>
      )*/}
      <Modal
      onClick={() => expandable && setOpen((open) => !open)}
        aria-labelledby="transition-modal-title"
        aria-describedby="transition-modal-description"
        className={nftStyles.modal}
        open={open}
        //onClose={handleClose}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500,
        }}
      >
        <Fade in={open}>
          <div className={nftStyles.paper}>
            {/* TODO: NftListItemDetails
            full picture, share, royaltees creators, explorer etc
            */}
            <BalanceListItemDetails
              isAssociatedToken={isAssociatedToken}
              publicKey={publicKey}
              // serumMarkets={serumMarkets}
              balanceInfo={balanceInfo}
            />
          </div>
        </Fade>
      </Modal>
    </>
  );
}


function BalanceListItemDetails({
  publicKey,
  serumMarkets,
  balanceInfo,
  isAssociatedToken,
}) {
  const urlSuffix = useSolanaExplorerUrlSuffix();
  const classes = useStyles();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [tokenInfoDialogOpen, setTokenInfoDialogOpen] = useState(false);
  const [exportAccDialogOpen, setExportAccDialogOpen] = useState(false);
  const [
    closeTokenAccountDialogOpen,
    setCloseTokenAccountDialogOpen,
  ] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const wallet = useWallet();
  const isProdNetwork = useIsProdNetwork();
  console.log("BalanceListItem balanceInfo", balanceInfo)
  /*const [swapInfo] = useAsyncData(async () => {
    if (!showSwapAddress || !isProdNetwork) {
      return null;
    }
    return await swapApiRequest(
      'POST',
      'swap_to',
      {
        blockchain: 'safe',
        coin: balanceInfo.mint?.toBase58(),
        address: publicKey.toBase58(),
      },
      { ignoreUserErrors: true },
    );
  }, [
    'swapInfo',
    isProdNetwork,
    balanceInfo.mint?.toBase58(),
    publicKey.toBase58(),
  ]);*/
  const isExtensionWidth = useIsExtensionWidth();

  if (!balanceInfo) {
    return <LoadingIndicator delay={0} />;
  }

  let { mint, tokenName, tokenSymbol, owner, amount } = balanceInfo;

  // Only show the export UI for the native SOL coin.
  /*const exportNeedsDisplay =
    mint === null && tokenName === 'SAFE' && tokenSymbol === 'SAFE';*/

  /*const market = tokenSymbol
    ? serumMarkets[tokenSymbol.toUpperCase()]
      ? serumMarkets[tokenSymbol.toUpperCase()].publicKey
      : undefined
    : undefined;*/
  const isSolAddress = publicKey.equals(owner);
  const additionalInfo = isExtensionWidth ? undefined : (
    <>
      <Typography variant="body2">
        Token Name: {tokenName ?? 'Unknown'}
      </Typography>
      <Typography variant="body2">
        Token Symbol: {tokenSymbol ?? 'Unknown'}
      </Typography>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          {!isSolAddress && isAssociatedToken === false && (
            <div style={{ display: 'flex' }}>
              This is an auxiliary token account.
            </div>
          )}
          <Typography variant="body2">
            <Link
              href={
                `https://explorer.safecoins.org/account/${publicKey.toBase58()}` + urlSuffix
              }
              target="_blank"
              rel="noopener"
            >
              View on Explorer
            </Link>
          </Typography>
          {/*market && (
            <Typography variant="body2">
              <Link
                href={`https://dex.projectserum.com/#/market/${market}`}
                target="_blank"
                rel="noopener"
              >
                View on Serum
              </Link>
            </Typography>
          )*/}
          {/*swapInfo && swapInfo.coin.erc20Contract && (
            <Typography variant="body2">
              <Link
                href={
                  `https://etherscan.io/token/${swapInfo.coin.erc20Contract}` +
                  urlSuffix
                }
                target="_blank"
                rel="noopener"
              >
                View on Ethereum
              </Link>
            </Typography>
              )*/}
          {!isSolAddress && (
            <Typography variant="body2">
              <Link
                className={classes.viewDetails}
                onClick={() => setShowDetails(!showDetails)}
              >
                View Details
              </Link>
            </Typography>
          )}
          {showDetails &&
            (mint ? (
              <Typography variant="body2" className={classes.address}>
                Mint Address: {mint.toBase58()}
              </Typography>
            ) : null)}
          {!isSolAddress && showDetails && (
            <Typography variant="body2" className={classes.address}>
              {isAssociatedToken ? 'Associated' : ''} Token Metadata:{' '}
              {publicKey.toBase58()}
            </Typography>
          )}
        </div>
        {/*exportNeedsDisplay && wallet.allowsExport && (
          <div>
            <Typography variant="body2">
              <Link href={'#'} onClick={(e) => setExportAccDialogOpen(true)}>
                Export
              </Link>
            </Typography>
          </div>
        )*/}
      </div>
    </>
  );

  return (
    <>
      {wallet.allowsExport && (
        <ExportAccountDialog
          onClose={() => setExportAccDialogOpen(false)}
          open={exportAccDialogOpen}
        />
      )}
      <div className={classes.itemDetails}>
        <div className={classes.buttonContainer}>
          {!publicKey.equals(owner) && showTokenInfoDialog ? (
            <Button
              variant="outlined"
              color="default"
              startIcon={<InfoIcon />}
              onClick={() => setTokenInfoDialogOpen(true)}
            >
              Token Info
            </Button>
          ) : null}
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ReceiveIcon />}
            onClick={() => setDepositDialogOpen(true)}
          >
            Receive
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<SendIcon />}
            onClick={() => setSendDialogOpen(true)}
          >
            Send
          </Button>
          {localStorage.getItem('warning-close-account') &&
            mint &&
            amount === 0 ? (
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={() => setCloseTokenAccountDialogOpen(true)}
            >
              Delete
            </Button>
          ) : null}
        </div>
        {additionalInfo}
      </div>
      <SendDialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        balanceInfo={balanceInfo}
        publicKey={publicKey}
      />
      <DepositDialog
        open={depositDialogOpen}
        onClose={() => setDepositDialogOpen(false)}
        balanceInfo={balanceInfo}
        publicKey={publicKey}
        //swapInfo={swapInfo}
        isAssociatedToken={isAssociatedToken}
      />
      <TokenInfoDialog
        open={tokenInfoDialogOpen}
        onClose={() => setTokenInfoDialogOpen(false)}
        balanceInfo={balanceInfo}
        publicKey={publicKey}
      />
      <CloseTokenAccountDialog
        open={closeTokenAccountDialogOpen}
        onClose={() => setCloseTokenAccountDialogOpen(false)}
        balanceInfo={balanceInfo}
        publicKey={publicKey}
      />
    </>
  );
}
