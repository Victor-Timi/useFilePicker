import { useContext, useEffect, useState } from 'react';

import { useModal } from '@/hooks';
import { MulticolumnContext } from '@/components/Elements/ReportingTool/Context/multicolumn-context';
import { Create } from '@/features/manage-documents/components/ItemTable/Create';
import { axios } from '@/lib/axios';

declare global {
  interface Window {
    gapi: any;
  }
}

export function useFilePicker() {
  const [accessToken, setAccessToken] = useState('');
  const [fileId, setFileId] = useState('');
  const [CreateModal, showCreateModal] = useModal();
  console.log('acc', accessToken);

  const {
    setFileUrl,
    setFileType,
    setFileName,
    setFileSize,
    setLastModified,
    setFileData,
  } = useContext(MulticolumnContext);

  const clientId = import.meta.env.VITE_APP_GOOGLE_CLIENT_ID!;
  const apiKey: string = import.meta.env.VITE_APP_GOOGLE_API_KEY!;
  const appId = import.meta.env.VITE_APP_GOOGLE_APP_ID!;
  const scope = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
  ];

  const [pickerInited, setPickerInited] = useState(false);

  const initializePicker = async () => {
    await gapi.load(
      'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    );
    setPickerInited(true);
  };

  async function handleOpenPicker() {
    gapi.load('auth', { callback: onAuthAPILoad });
    gapi.load('picker', { callback: onPickerAPILoad });
  }

  function onAuthAPILoad() {
    window.gapi.auth.authorize(
      {
        client_id: clientId,
        scope: scope,
        immediate: false,
      },
      handleAuthResult
    );
  }

  function handleAuthResult(response: GoogleApiOAuth2TokenObject) {
    if (response && !response.error) {
      setAccessToken(response.access_token);
      createPicker();
    } else {
      console.log('error', response.error);
    }
  }

  function onPickerAPILoad() {
    createPicker();
  }

  async function createPicker() {
    if (!pickerInited) {
      await initializePicker();
    }

    var DocsView = new google.picker.DocsView(
      google.picker.ViewId.DOCS
    ).setOwnedByMe(true);
    var picker = new google.picker.PickerBuilder()
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
      .addView(DocsView)
      .addView(new google.picker.DocsUploadView())
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setOAuthToken(accessToken)
      .setCallback(pickerCallback)
      .build();
    picker.setVisible(true);
  }

  async function pickerCallback(data: any) {
    if (data.docs && data.docs.length > 0) {
      const selectedFile = data.docs[0];
      const fileId = selectedFile.id;
      const fileName = selectedFile.name;
      const fileType = selectedFile.type;
      const fileSize = bytesToMegabytes(selectedFile.sizeBytes);
      const lastModified = new Date(selectedFile.lastEditedUtc).toDateString();
      const fileUrl = selectedFile.url;
      setFileId(fileId);
      setFileUrl(fileUrl);
      setFileType(fileType);
      setFileName(fileName);
      setFileSize(fileSize);
      setLastModified(lastModified);
    } else {
      console.warn('No documents found in data.docs');
    }

    if (data.action === google.picker.Action.PICKED) {
      showCreateModal({
        showModal(onClose) {
          return <Create Id="a" onClose={onClose} />;
        },
        options: {
          className: 'border-t-2 px-0 py-0',
          position: 'center',
          size: 'mx',
        },
      });
    }
  }

  useEffect(() => {
    function sendPickerData() {
      if (fileId && accessToken) {
        const url = '/documents/picker';
        const requestData = {
          fileId: fileId,
          access_token: accessToken,
        };

        axios
          .post(url, requestData)
          .then((response) => {
            if (response.status !== 200) {
              throw new Error(response.data.error || 'Unknown error occurred.');
            }
            return response.data;
          })
          .then((responseData) => {
            const webViewLink = responseData.webViewLink;
            const webContentLink = responseData.webContentLink;
            setFileData({
              webContentLink,
              webViewLink,
            });
          })
          .catch((error) => {
            console.error('Error sending data to backend:', error);
          })
          .finally(() => {
            setAccessToken('');
            setFileId('');
          });
      }
    }

    sendPickerData();
  }, [fileId]);

  function bytesToMegabytes(bytes: number, decimalPlaces = 2) {
    const megabytes = bytes / (1024 * 1024);
    return `${megabytes.toFixed(decimalPlaces)}MB`;
  }

  return { CreateModal, handleOpenPicker };
}
