const {
  PDFDocument,
  StandardFonts
} = PDFLib

const $ = (...args) => document.querySelector(...args)
const $$ = (...args) => document.querySelectorAll(...args)
const $$$ = (...args) => [...document.querySelectorAll(...args)]

const generateQR = async text => {
  try {
    var opts = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
    }
    return await QRCode.toDataURL(text, opts)
  } catch (err) {
    console.error(err)
  }
}

function getProfile() {
  const obj = {};
  for (field of $$('#form-profile input:not([disabled]):not([type=checkbox])')) {
    obj[field.id.substring('field-'.length)] = field.value;
  }
  return obj;
}

function getReasons() {
  return $$$('input[name="field-reason"]:checked').map(x => x.value).join('-');
}

function hasHash() {
  return window.location.hash.length > 0;
}

function myFormat(refDate) {
  const creationDate = refDate.toLocaleDateString('fr-FR')
  const creationHour = refDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  }).replace(':', 'h')
  return {
    "creationDate": creationDate,
    "creationHour": creationHour
  };
}

async function generatePdf(profile, reasons, refDate) {
  const url = 'certificate.pdf'
  const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer())

  const {
    creationDate,
    creationHour
  } = myFormat(refDate);

  const {
    lastname,
    firstname,
    birthday,
    lieunaissance,
    address,
    zipcode,
    town
  } = profile

  const data = [
    `Cree le: ${creationDate} a ${creationHour}`,
    `Nom: ${lastname}`,
    `Prenom: ${firstname}`,
    `Naissance: ${birthday} a ${lieunaissance}`,
    `Adresse: ${address} ${zipcode} ${town}`,
    `Sortie: ${creationDate} a ${creationHour}`,
    `Motifs: ${reasons}`,
  ].join('; ')

  const pdfDoc = await PDFDocument.load(existingPdfBytes)
  const page1 = pdfDoc.getPages()[0]

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const drawText = (text, x, y, size = 11) => {
    page1.drawText(text, {
      x,
      y,
      size,
      font
    })
  }

  drawText(`${firstname} ${lastname}`, 125, 685)
  drawText(birthday, 125, 661)
  drawText(lieunaissance, 95, 637)
  drawText(`${address} ${zipcode} ${town}`, 140, 613)

  if (reasons.includes('travail')) {
    drawText('x', 76.5, 526, 20)
  }
  if (reasons.includes('courses')) {
    drawText('x', 76.5, 476.5, 20)
  }
  if (reasons.includes('sante')) {
    drawText('x', 76.5, 436, 20)
  }
  if (reasons.includes('famille')) {
    drawText('x', 76.5, 399.5, 20)
  }
  if (reasons.includes('sport')) {
    drawText('x', 76.5, 344, 20)
  }
  if (reasons.includes('judiciaire')) {
    drawText('x', 76.5, 297, 20)
  }
  if (reasons.includes('missions')) {
    drawText('x', 76.5, 261, 20)
  }

  drawText(town, 110, 225)

  if (reasons.length > 0) {
    // Date sortie
    drawText(creationDate, 92, 201);
    drawText(String(refDate.getHours()).padStart(2, '0'), 200, 201);
    drawText(String(refDate.getMinutes()).padStart(2, '0'), 220, 201);
  }

  // Date création
  drawText('Date de création:', 464, 150, 7)
  drawText(`${creationDate} à ${creationHour}`, 455, 144, 7)

  const generatedQR = await generateQR(data)

  const qrImage = await pdfDoc.embedPng(generatedQR)

  page1.drawImage(qrImage, {
    x: page1.getWidth() - 170,
    y: 155,
    width: 100,
    height: 100,
  })

  pdfDoc.addPage()
  const page2 = pdfDoc.getPages()[1]
  page2.drawImage(qrImage, {
    x: 50,
    y: page2.getHeight() - 350,
    width: 300,
    height: 300,
  })

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], {
    type: 'application/pdf'
  })
}

function downloadBlob(blob, fileName) {
  const link = document.createElement('a')
  var url = URL.createObjectURL(blob)
  link.href = url
  link.download = fileName
  link.click()
}

// see: https://stackoverflow.com/a/32348687/1513045
function isFacebookBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera
  return (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1)
}

if (isFacebookBrowser()) {
  $('#alert-facebook').style.display = 'block';
}

if (hasHash()) {
  $('#generate-pdf').style.display = 'block'
} else {
  $('#form-profile').style.display = 'block'
}

function restoreFromHash(value) {
  try {
    var obj = JSON.parse(atob(value.substr(1)));
    const reasons = obj.reasons;
    delete obj.reasons;
    return {
      'profile': obj,
      'reasons': reasons
    };
  } catch (e) {
    return {};
  }
}

function toHash(profile, reasons) {
  const formated = Object.assign({}, profile);
  formated['reasons'] = reasons;
  return '#' + btoa(JSON.stringify(formated));
}

async function downloadPDF(profile, reasons, shift) {
  var refDate = new Date();
  refDate.setMinutes(refDate.getMinutes() - shift);

  const {
    creationDate,
    creationHour
  } = myFormat(refDate);
  const pdfBlob = await generatePdf(profile, reasons, refDate);
  downloadBlob(pdfBlob, `attestation-${creationDate}_${creationHour}.pdf`);
}

$('#form-profile').addEventListener('submit', event => {
  event.preventDefault()

  window.location.href = window.location.href + toHash(getProfile(), getReasons());

  window.location.reload();

});

$('#form-pdf-0').addEventListener('submit', event => {
  event.preventDefault()
  const data = restoreFromHash(window.location.hash);

  downloadPDF(data.profile, data.reasons, 0);

});

$('#form-pdf-15').addEventListener('submit', event => {
  event.preventDefault()
  const data = restoreFromHash(window.location.hash);

  downloadPDF(data.profile, data.reasons, 15);

});

$('#form-pdf-30').addEventListener('submit', event => {
  event.preventDefault()
  const data = restoreFromHash(window.location.hash);

  downloadPDF(data.profile, data.reasons, 30);

});

function addSlash() {
  $('#field-birthday').value = $('#field-birthday').value.replace(/^(\d{2})$/g, '$1/')
  $('#field-birthday').value = $('#field-birthday').value.replace(/^(\d{2})\/(\d{2})$/g, '$1/$2/')
  $('#field-birthday').value = $('#field-birthday').value.replace(/\/\//g, '/')
}

$('#field-birthday').onkeyup = function() {
  const key = event.keyCode || event.charCode
  if (key === 8 || key === 46) {
    return false
  } else {
    addSlash()
    return false
  }
}

$$('input').forEach(input => {
  const exempleElt = input.parentNode.parentNode.querySelector('.exemple')
  if (input.placeholder && exempleElt) {
    input.addEventListener('input', (event) => {
      if (input.value) {
        exempleElt.innerHTML = 'ex.&nbsp;: ' + input.placeholder
      } else {
        exempleElt.innerHTML = ''
      }
    })
  }
})
})
