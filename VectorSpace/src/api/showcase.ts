/**
 * @file        showcase.ts
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Published student museums shown in the sign-in page carousel.
 *              Returns fake data for now; will call the backend once it exists
 *              (only museums marked as showcase-safe).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

/** One museum card in the sign-in carousel. */
export type ShowcaseMuseum = {
  id: string;
  title: string;
  studentName: string;
  className: string;
  schoolName: string;
  subject: string;
  exhibitCount: number;
  roomCount: number;
  imageUrl?: string;
};

/** Gets the museums for the carousel. Fake data until the backend is ready. */
export async function getShowcaseMuseums(): Promise<ShowcaseMuseum[]> {
  return [
    {
      id: "m1",
      title: "Dino Discovery Hall",
      studentName: "Aisyah",
      className: "Sec 2B",
      schoolName: "Riverside Secondary",
      subject: "Science",
      exhibitCount: 12,
      roomCount: 3,
    },
    {
      id: "m2",
      title: "Life in a Kampong",
      studentName: "Ravi",
      className: "Class 2C",
      schoolName: "Northview Academy",
      subject: "History",
      exhibitCount: 8,
      roomCount: 2,
    },
  ];
}