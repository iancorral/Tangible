import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Catálogo inicial de Tangible para una base de datos VACÍA.
 *
 * Nunca borra nada: antes eliminaba todas las citas y servicios, y como el
 * .env apunta a producción, un `npx prisma db seed` habría borrado la agenda
 * real. Ahora solo crea el estudio si no existe y su catálogo si está vacío.
 */
const SERVICES = [
      // UÑAS
      { name: 'Uñas de tip acrílico o polygel', duration: 120, price: 550, category: 'Uñas', isActive: true },
      { name: 'Uñas esculturales', duration: 120, price: 600, category: 'Uñas', isActive: true },
      { name: 'Uñas Softgel', duration: 90, price: 500, category: 'Uñas', isActive: true },
      { name: 'Estructura híbrida', duration: 90, price: 600, category: 'Uñas', isActive: true },
      { name: 'Baño de gel Rubber', duration: 60, price: 470, category: 'Uñas', isActive: true },
      { name: 'Baño de polygel o acrílico', duration: 60, price: 500, category: 'Uñas', isActive: true },
      { name: 'Retoque acrílico o polygel', duration: 60, price: 500, category: 'Uñas', isActive: true },
      { name: 'Gel semipermanente (shellac)', duration: 60, price: 300, category: 'Uñas', isActive: true },
      // EXTRAS
      { name: 'Retiro shellac', duration: 20, price: 100, category: 'Extras', isActive: true },
      { name: 'Retiro acrílico', duration: 30, price: 200, category: 'Extras', isActive: true },
      // MANICURA Y PEDICURA
      { name: 'Manicura o pedicura rusa', duration: 60, price: 250, category: 'Manicura y Pedicura', isActive: true },
      { name: 'Pedicura express + shellac', duration: 60, price: 480, category: 'Manicura y Pedicura', isActive: true },
      { name: 'Acripie en pulgares + shellac', duration: 60, price: 350, category: 'Manicura y Pedicura', isActive: true },
      { name: 'Acripie completo + shellac', duration: 90, price: 450, category: 'Manicura y Pedicura', isActive: true },
      { name: 'Pedicura completo + shellac', duration: 90, price: 600, category: 'Manicura y Pedicura', isActive: true },
      // MAQUILLAJE Y PEINADO
      { name: 'Maquillaje social', duration: 60, price: 1200, category: 'Maquillaje y Peinado', isActive: true },
      { name: 'Maquillaje de novia o XV', duration: 90, price: 1700, category: 'Maquillaje y Peinado', isActive: true },
      { name: 'Maquillaje con hilos tensores', duration: 90, price: 1700, category: 'Maquillaje y Peinado', isActive: true },
      { name: 'Secado o planchado', duration: 30, price: 400, category: 'Maquillaje y Peinado', isActive: true },
      { name: 'Ondulado', duration: 45, price: 500, category: 'Maquillaje y Peinado', isActive: true },
      { name: 'Peinado semi-recogido', duration: 45, price: 600, category: 'Maquillaje y Peinado', isActive: true },
      { name: 'Peinado recogido', duration: 60, price: 700, category: 'Maquillaje y Peinado', isActive: true },
      { name: 'Peinado de novia o XV', duration: 90, price: 800, category: 'Maquillaje y Peinado', isActive: true },
      // CEJAS
      { name: 'Laminado de cejas', duration: 45, price: 200, category: 'Cejas', isActive: true },
      { name: 'Laminado + depilación', duration: 60, price: 350, category: 'Cejas', isActive: true },
]

async function main() {
  const studio = await prisma.studio.upsert({
    where: { slug: 'tangible' },
    update: {},
    create: {
      slug: 'tangible',
      name: 'Tangible Nails & Art Studio',
      shortName: 'Tangible',
      logoPath: null,
      features: { rewards: true, publicBooking: true },
    },
  })

  const existing = await prisma.service.count({ where: { studioId: studio.id } })
  if (existing > 0) {
    console.log(`Tangible ya tiene ${existing} servicios; no se crea nada.`)
    return
  }

  await prisma.service.createMany({
    data: SERVICES.map((service) => ({ ...service, studioId: studio.id })),
  })
  console.log(`${SERVICES.length} servicios creados para Tangible.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
