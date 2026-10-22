/*******************************************************
 * STS VISIO SYNC
 *
 * Google Sheets -> XLSX
 *
 * Bu dosya mevcut STS Envarter Backend.gs dosyasından
 * bağımsız çalışır.
 *
 * Kaynak:
 *   Aktif Google Sheets
 *
 * Çıktı:
 *   STS-Visio-Sync.xlsx
 *
 * Mevcut Google Sheets verilerini değiştirmez.
 *******************************************************/


const STS_VISIO_OUTPUT_NAME = 'STS-Visio-Sync.xlsx';


/**
 * Google Sheets'i XLSX olarak dışarı aktarır.
 *
 * Mevcut Google Sheets dosyasına dokunmaz.
 */
function STS_VISIO_EXPORT_XLSX() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      'Aktif Google Sheets dosyası bulunamadı.'
    );
  }

  const sourceSpreadsheetId = ss.getId();

  // Google Sheets dosyasının bulunduğu Drive klasörünü bul
  const sourceFile =
    DriveApp.getFileById(sourceSpreadsheetId);

  const parentFolders =
    sourceFile.getParents();

  if (!parentFolders.hasNext()) {
    throw new Error(
      'Google Sheets dosyasının bulunduğu Drive klasörü bulunamadı.'
    );
  }

  const parentFolder =
    parentFolders.next();


  /*******************************************************
   * XLSX EXPORT
   *******************************************************/

  const exportUrl =
    'https://www.googleapis.com/drive/v3/files/' +
    sourceSpreadsheetId +
    '/export?mimeType=' +
    encodeURIComponent(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );


  const accessToken =
    ScriptApp.getOAuthToken();


  const response =
    UrlFetchApp.fetch(
      exportUrl,
      {
        method: 'get',

        headers: {
          Authorization:
            'Bearer ' + accessToken
        },

        muteHttpExceptions: true
      }
    );


  const responseCode =
    response.getResponseCode();


  if (responseCode !== 200) {

    throw new Error(
      'Google Sheets -> XLSX export başarısız.\n' +
      'HTTP Code: ' +
      responseCode +
      '\n' +
      response.getContentText()
    );

  }


  const xlsxBlob =
    response.getBlob()
      .setName(STS_VISIO_OUTPUT_NAME)
      .setContentType(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );


  /*******************************************************
   * MEVCUT DOSYAYI BUL
   *******************************************************/

  const existingFiles =
    parentFolder.getFilesByName(
      STS_VISIO_OUTPUT_NAME
    );


  /*******************************************************
   * DOSYA VARSA GÜNCELLE
   *******************************************************/

  if (existingFiles.hasNext()) {

    const existingFile =
      existingFiles.next();

    const existingFileId =
      existingFile.getId();


    const updateUrl =
      'https://www.googleapis.com/upload/drive/v3/files/' +
      existingFileId +
      '?uploadType=media';


    const updateResponse =
      UrlFetchApp.fetch(
        updateUrl,
        {
          method: 'patch',

          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

          payload:
            xlsxBlob.getBytes(),

          headers: {
            Authorization:
              'Bearer ' + accessToken
          },

          muteHttpExceptions: true
        }
      );


    const updateCode =
      updateResponse.getResponseCode();


    if (
      updateCode < 200 ||
      updateCode >= 300
    ) {

      throw new Error(
        'STS-Visio-Sync.xlsx güncellenemedi.\n' +
        'HTTP Code: ' +
        updateCode +
        '\n' +
        updateResponse.getContentText()
      );

    }


    console.log(
      'STS-Visio-Sync.xlsx başarıyla güncellendi.'
    );


  } else {


    /*******************************************************
     * DOSYA YOKSA İLK KEZ OLUŞTUR
     *******************************************************/

    parentFolder.createFile(
      xlsxBlob
    );


    console.log(
      'STS-Visio-Sync.xlsx başarıyla oluşturuldu.'
    );

  }


}


/**
 * Otomatik 15 dakikalık trigger oluşturur.
 *
 * BU FONKSİYON SADECE BİR KEZ ÇALIŞTIRILMALIDIR.
 */
function STS_VISIO_CREATE_TRIGGER() {

  const triggers =
    ScriptApp.getProjectTriggers();


  /*******************************************************
   * DAHA ÖNCE OLUŞTURULMUŞSA TEKRAR OLUŞTURMA
   *******************************************************/

  for (
    const trigger of triggers
  ) {

    if (
      trigger.getHandlerFunction() ===
      'STS_VISIO_EXPORT_XLSX'
    ) {

      console.log(
        'STS Visio Sync trigger zaten mevcut.'
      );

      return;

    }

  }


  /*******************************************************
   * YENİ TRIGGER
   *******************************************************/

  ScriptApp.newTrigger(
    'STS_VISIO_EXPORT_XLSX'
  )
  .timeBased()
  .everyMinutes(15)
  .create();


  console.log(
    'STS Visio Sync otomatik trigger oluşturuldu.'
  );

}