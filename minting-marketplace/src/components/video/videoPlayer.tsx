import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import Swal from 'sweetalert2';

import { VideoPlayerParams } from './video.types';

import {
  TAuthGetChallengeResponse,
  TOnlySuccessResponse
} from '../../axios.responseTypes';
import { RootState } from '../../ducks';
import { ContractsInitialType } from '../../ducks/contracts/contracts.types';
import { reactSwal } from '../../utils/reactSwal';
import setDocumentTitle from '../../utils/setTitle';
import NewVideo from '../MockUpPage/NftList/NftData/NftVideoplayer/NewVideo';

const VideoPlayer = () => {
  const params = useParams<VideoPlayerParams>();
  const { /*contract,*/ mainManifest, videoId } = params;
  const {
    programmaticProvider,
    currentUserAddress /*, currentChain, minterInstance*/
  } = useSelector<RootState, ContractsInitialType>((state) => {
    return state.contractStore;
  });
  const [videoName] = useState(videoId);
  const [mediaAddress, setMediaAddress] = useState<string | null>('');

  const requestChallenge = useCallback(async () => {
    let signature;
    let parsedResponse;
    if (window.ethereum) {
      const account = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      const getChallengeResponse = await axios.post<TAuthGetChallengeResponse>(
        '/api/auth/get_challenge/',
        {
          userAddress: currentUserAddress,
          intent: 'decrypt',
          mediaId: videoId
        }
      );
      const { response } = getChallengeResponse.data;
      parsedResponse = JSON.parse(response);
      signature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [account && account[0], response],
        from: account && account[0]
      });
    } else if (programmaticProvider) {
      const responseWithProgrammaticProvider =
        await axios.get<TAuthGetChallengeResponse>(
          '/api/auth/get_challenge/' + programmaticProvider.address
        );
      const { response } = responseWithProgrammaticProvider.data;
      parsedResponse = JSON.parse(response);
      // EIP712Domain is added automatically by Ethers.js!
      const { /* EIP712Domain,*/ ...revisedTypes } = parsedResponse.types;

      signature = await programmaticProvider._signTypedData(
        parsedResponse.domain,
        revisedTypes,
        parsedResponse.message
      );
    } else {
      Swal.fire('Error', 'Unable to decrypt videos', 'error');
      return;
    }

    try {
      const streamAddress = await axios.post<TOnlySuccessResponse>(
        '/api/auth/validate/',
        {
          MetaMessage: parsedResponse.message.challenge,
          MetaSignature: signature,
          mediaId: videoId
        }
      );
      if (streamAddress.data.success) {
        setMediaAddress('/stream/' + videoId + '/' + mainManifest);
        //videojs('vjs-' + videoName);
      }
    } catch (err) {
      const error = err as AxiosError;
      console.error(error.message);
      reactSwal.fire({
        title: 'NFT required to view this content'
      });
    }
  }, [mainManifest, videoId, programmaticProvider, currentUserAddress]);

  useEffect(() => {
    requestChallenge();
    return () => {
      setMediaAddress('');
    };
  }, [requestChallenge]);

  useEffect(() => {
    setDocumentTitle('Streaming');
  }, [videoName]);

  useEffect(() => {
    return () => {
      axios.get<TOnlySuccessResponse>('/api/auth/stream/out');
    };
  }, [videoName]);

  return (
    <div
      className="col-12 row mx-0 h1 iframe-video-player"
      onClick={() => {
        if (mediaAddress === '') {
          requestChallenge();
        }
      }}
      style={{ minHeight: '100vh' }}>
      {mediaAddress !== '' && (
        <NewVideo
          videoData={mediaAddress}
          selectVideo={''}
          videoIdName={videoName}
        />
      )}
    </div>
  );
};

export default VideoPlayer;
